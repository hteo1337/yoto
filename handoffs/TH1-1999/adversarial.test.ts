import {spawn} from "node:child_process"
import {once} from "node:events"
import {access, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises"
import http from "node:http"
import {tmpdir} from "node:os"
import {join, resolve} from "node:path"

import {expect, it, vi} from "vitest"

import {createBindings} from "../../selfhost/shims/bindings"
import {getSandbox, sandboxDirectory} from "../../selfhost/shims/sandbox"
import {ProgressStore} from "../../selfhost/shims/storage"
import {WorkflowStep} from "../../selfhost/shims/workers"
import {ImportWorkflow} from "../../workers/import-workflow"

const observed = vi.hoisted(() => ({argv: [] as string[]}))
vi.mock("@cloudflare/sandbox", async () => {
    const {getSandbox} = await import("../../selfhost/shims/sandbox")
    return {
        getSandbox: (binding: unknown, id: string) => {
            const sandbox = getSandbox(binding, id)
            return {
                ...sandbox,
                exec: async (command: string) => {
                    // A local argv recorder replaces ONLY the external downloader.
                    const result = await sandbox.exec(
                        `function yt-dlp() { printf '%s\\n' "$@"; }; ${command}`,
                    )
                    observed.argv.push(result.stdout)
                    return result
                },
            }
        },
    }
})
import {downloadVideo} from "../../app/lib/sandbox.server"

it("adversarial real-path smoke and interrupted-scratch reclamation", async () => {
    const root = await mkdtemp(join(tmpdir(), "yoto-adversarial-"))
    const suffix = crypto.randomUUID()
    const id = `import-${suffix}`
    const owned = sandboxDirectory(id)
    const control = getSandbox(null, `control-${suffix}`)
    const sentinel = join(root, "shell-injection")
    const env = {
        YOTO_CLIENT_ID: "synthetic-client",
        YOTO_AUTH_SECRET: "synthetic-test-only",
        RESEND_API_KEY: "synthetic-unused",
    } as Env
    let server: ReturnType<typeof spawn> | undefined
    let runSpy: ReturnType<typeof vi.spyOn> | undefined
    let release: (() => void) | undefined
    try {
        // Shell, traversal, environment and output controls against the actual shim.
        expect(() => sandboxDirectory("../../outside")).toThrow(
            "Invalid sandbox ID",
        )
        expect(() => sandboxDirectory("/absolute")).toThrow(
            "Invalid sandbox ID",
        )
        await writeFile(join(root, "outside-survives"), "control")
        const video = {
            id: `../../outside'$(touch ${sentinel})`,
            title: `'; touch ${sentinel}; #`,
            url: `https://youtu.be/test'; touch ${sentinel}; #`,
        }
        const audio = await downloadVideo(env, id, video)
        expect(audio.path).toBe(`${owned}/${encodeURIComponent(video.id)}.m4a`)
        expect(observed.argv.join("\n")).toContain(video.url)
        await expect(access(sentinel)).rejects.toThrow()
        const sandbox = getSandbox(null, id)
        expect(
            await sandbox.exec(
                'test -z "${YOTO_AUTH_SECRET+x}" && test -z "${TS_AUTHKEY+x}" && printf env-clean',
            ),
        ).toMatchObject({success: true, stdout: "env-clean"})
        expect(await sandbox.exec("printf small")).toMatchObject({
            success: true,
            stdout: "small",
        })
        const oversized = await sandbox.exec("head -c 8388609 /dev/zero")
        expect(oversized.success).toBe(false)
        expect(oversized.stderr).toBe("Sandbox output limit exceeded")
        expect(Buffer.byteLength(oversized.stdout)).toBeLessThanOrEqual(8388608)
        await sandbox.destroy()
        await expect(access(owned)).rejects.toThrow()
        expect(await readFile(join(root, "outside-survives"), "utf8")).toBe(
            "control",
        )
        process.stdout.write(
            "PROBE shell/path/env/output: rejected traversal, no injection, outside sentinel preserved, oversized output rejected\n",
        )

        // Actual binding scheduler: concurrent duplicate ID admission and 3-slot bound.
        const gate = new Promise<void>(resolve => {
            release = resolve
        })
        let active = 0,
            peak = 0
        runSpy = vi
            .spyOn(ImportWorkflow.prototype, "run")
            .mockImplementation(async function (event) {
                peak = Math.max(peak, ++active)
                await gate
                active--
                await this.env.IMPORT_PROGRESS.getByName(
                    event.payload.id,
                ).reportError("synthetic-stop")
                return {
                    importId: event.payload.id,
                    status: "success",
                    message: "unused",
                    added: 0,
                    skipped: 0,
                }
            })
        const bindings = createBindings(env, join(root, "scheduler"))
        const params = {
            id: "same-id",
            cardId: "same-card",
            youtubeUrl: "https://youtu.be/test",
            splitByChapters: false,
            credential: "unused",
        }
        const duplicate = await Promise.allSettled(
            [1, 2].map(() =>
                bindings.IMPORT_WORKFLOW.create({id: "same-id", params}),
            ),
        )
        expect(duplicate.map(r => r.status).sort()).toEqual([
            "fulfilled",
            "rejected",
        ])
        await Promise.all(
            ["two", "three", "four"].map(id =>
                bindings.IMPORT_WORKFLOW.create({id, params: {...params, id}}),
            ),
        )
        await new Promise(resolve => setTimeout(resolve, 20))
        expect(peak).toBe(3)
        release()
        await new Promise(resolve => setTimeout(resolve, 20))
        expect(runSpy).toHaveBeenCalledTimes(4)
        runSpy.mockRestore()
        const step = new WorkflowStep()
        let attempts = 0
        await expect(
            step.do(
                "exhaust",
                {retries: {limit: 1, delay: 1}, timeout: 100},
                async () => {
                    attempts++
                    throw Error("reject")
                },
            ),
        ).rejects.toThrow("reject")
        expect(attempts).toBe(2)
        await expect(
            step.do(
                "deadline",
                {retries: {limit: 0, delay: 0}, timeout: 10},
                () => control.exec("sleep 10"),
            ),
        ).rejects.toThrow("timed out")
        await control.destroy()
        process.stdout.write(
            "PROBE concurrency/deadline: one duplicate admitted, peak=3, queued fourth ran, exhaustion/deadline rejected\n",
        )

        // Seed one interrupted download, then boot the actual built Node entry once.
        const progress = join(root, "progress")
        const store = new ProgressStore(progress)
        await store
            .forImport(suffix)
            .put("event", {type: "progress", phase: "importing", percent: 20})
        await mkdir(owned, {recursive: true})
        await writeFile(join(owned, "download.m4a.part"), "orphaned audio")
        const socket = http.createServer()
        await new Promise<void>(resolve =>
            socket.listen(0, "127.0.0.1", resolve),
        )
        const port = (socket.address() as {port: number}).port
        await new Promise<void>(resolve => socket.close(() => resolve()))
        server = spawn(
            process.execPath,
            [resolve("build-selfhost/server/index.js")],
            {
                env: {
                    PATH: process.env.PATH,
                    PUBLIC_ORIGIN: "https://review.example.ts.net",
                    YOTO_CLIENT_ID: env.YOTO_CLIENT_ID,
                    YOTO_AUTH_SECRET: env.YOTO_AUTH_SECRET,
                    RESEND_API_KEY: env.RESEND_API_KEY,
                    PROGRESS_DIR: progress,
                    PORT: String(port),
                    NODE_ENV: "production",
                },
                stdio: ["ignore", "ignore", "ignore"],
            },
        )
        let ready = false
        for (let attempt = 0; attempt < 100; attempt++) {
            try {
                const response = await fetch(`http://127.0.0.1:${port}/healthz`)
                if (response.status === 200) {
                    ready = true
                    break
                }
            } catch {}
            await new Promise(resolve => setTimeout(resolve, 20))
        }
        expect(ready).toBe(true)
        const raw = (
            path: string,
            method = "POST",
            headers: Record<string, string> = {},
        ) =>
            new Promise<{status: number; headers: http.IncomingHttpHeaders}>(
                (resolve, reject) => {
                    const request = http.request(
                        {
                            hostname: "127.0.0.1",
                            port,
                            path,
                            method,
                            headers: {
                                "Host": "evil.invalid",
                                "Forwarded": "host=evil.invalid;proto=http",
                                "X-Forwarded-Host": "evil.invalid",
                                "X-Forwarded-Proto": "http",
                                ...headers,
                            },
                        },
                        response => {
                            response.resume()
                            response.on("end", () =>
                                resolve({
                                    status: response.statusCode!,
                                    headers: response.headers,
                                }),
                            )
                        },
                    )
                    request.on("error", reject)
                    request.end()
                },
            )
        for (const path of [
            "/login",
            "http://evil.invalid/login",
            "//evil.invalid/login",
            "/x/../login",
            "/%2e/login",
            "/\\evil.invalid/login",
        ]) {
            const response = await raw(path)
            expect(response.status, path).toBe(302)
            expect(
                new URL(response.headers.location!).searchParams.get(
                    "redirect_uri",
                ),
                path,
            ).toBe("https://review.example.ts.net/auth/callback")
            const cookie = response.headers["set-cookie"]!.join(";")
            expect(cookie).toContain("Secure")
            expect(cookie).toContain("HttpOnly")
            expect(cookie).toContain("SameSite=Lax")
            expect(cookie).not.toMatch(/Domain=/i)
        }
        expect((await raw("/cards", "GET")).status).toBe(302)
        expect(
            (await raw("/api/import/card?url=https://youtu.be/test", "GET"))
                .status,
        ).toBe(401)
        const callback = await raw(
            "/auth/callback?code=synthetic&state=wrong",
            "GET",
        )
        expect(callback.headers.location).toBe("/login?error=expired_state")
        process.stdout.write(
            "PROBE origin/auth: 6 path/authority variants kept canonical origin + secure host-only cookie; unauthenticated import 401; missing-state callback denied\n",
        )
        const record = JSON.parse(
            await readFile(join(progress, `${suffix}.json`), "utf8"),
        )
        expect(record.event).toEqual({
            type: "error",
            error: "Import interrupted by server restart",
        })
        // Desired recovery invariant; this assertion FAILS on the reviewed head.
        const scratchSurvives = await access(
            join(owned, "download.m4a.part"),
        ).then(
            () => true,
            () => false,
        )
        process.stdout.write(
            `PROBE restart: terminalError=${record.event.type === "error"} interruptedScratchSurvives=${scratchSurvives}\n`,
        )
        expect(
            scratchSurvives,
            "startup must reclaim scratch for terminal interrupted imports",
        ).toBe(false)
    } finally {
        release?.()
        runSpy?.mockRestore()
        if (server && server.exitCode === null) {
            const closed = once(server, "exit")
            server.kill("SIGTERM")
            await closed
        }
        await getSandbox(null, id).destroy()
        await control.destroy()
        await rm(root, {recursive: true, force: true})
    }
}, 20000)
