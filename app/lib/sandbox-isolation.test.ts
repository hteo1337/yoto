import {mkdtemp, rm} from "node:fs/promises"
import http from "node:http"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Writable} from "node:stream"

import {expect, it, vi} from "vitest"

import {createMockEnv} from "~/tests/mocks"

import {forwardBody} from "../../selfhost/response"
import {createBindings} from "../../selfhost/shims/bindings"
import {getSandbox as nodeSandbox} from "../../selfhost/shims/sandbox"
import {ProgressStore} from "../../selfhost/shims/storage"
import {installFetchDeadline, WorkflowStep} from "../../selfhost/shims/workers"
import {ImportProgress} from "../../workers/import-progress"

const exec = vi.hoisted(() =>
    vi.fn(async () => ({success: true, stdout: "", stderr: ""})),
)
vi.mock("@cloudflare/sandbox", () => ({getSandbox: () => ({exec})}))

import {downloadVideo} from "./sandbox.server"

it("isolates imports and supports the self-host runtime contract", async () => {
    const video = {
        id: "same-video",
        title: "Example",
        url: "https://youtu.be/same-video",
    }
    const first = await downloadVideo(createMockEnv(), "import-one", video)
    const second = await downloadVideo(createMockEnv(), "import-two", video)
    expect(first.path).not.toBe(second.path)
    expect(first.path).toBe("/tmp/yoto/import-one/same-video.m4a")
    expect(second.path).toBe("/tmp/yoto/import-two/same-video.m4a")
    expect(exec).toHaveBeenCalledWith(
        expect.stringContaining("mkdir -p /tmp/yoto/import-one"),
    )
    const step = new WorkflowStep()
    const options = {
        retries: {limit: 2, delay: 1, backoff: "exponential"},
        timeout: 1000,
    }
    let attempts = 0
    await expect(
        step.do("retry", options, async () => {
            if (++attempts < 3) throw new Error("retry me")
            return attempts
        }),
    ).resolves.toBe(3)
    await expect(
        step.do(
            "exhaust",
            {retries: {limit: 0, delay: 0}, timeout: 1000},
            async () => {
                throw new Error("no retry")
            },
        ),
    ).rejects.toThrow("no retry")
    const sandbox = nodeSandbox(null, "import-runtime-test")
    await expect(sandbox.exec("printf bounded")).resolves.toMatchObject({
        success: true,
        stdout: "bounded",
    })
    await expect(
        step.do(
            "timeout",
            {retries: {limit: 0, delay: 0}, timeout: 10},
            async () => {
                await sandbox.exec("sleep 10")
                return "late"
            },
        ),
    ).rejects.toThrow("timed out")
    await sandbox.destroy()
    installFetchDeadline()
    const upstream = http.createServer(() => {})
    await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve))
    try {
        const address = upstream.address() as {port: number}
        await expect(
            step.do(
                "SDK timeout",
                {retries: {limit: 0, delay: 0}, timeout: 20},
                () =>
                    new Promise((_resolve, reject) => {
                        http.get(`http://127.0.0.1:${address.port}`, response =>
                            response.resume(),
                        ).on("error", reject)
                    }),
            ),
        ).rejects.toThrow("timed out")
    } finally {
        upstream.closeAllConnections()
        await new Promise<void>(resolve => upstream.close(() => resolve()))
    }
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(new TextEncoder().encode("SSE event"))
        },
        cancel() {
            cancelled = true
        },
    })
    const disconnected = new Writable({
        write(_chunk, _encoding, callback) {
            callback()
            this.destroy()
        },
    })
    await expect(forwardBody(body, disconnected)).rejects.toThrow()
    expect(cancelled).toBe(true)
    const directory = await mkdtemp(join(tmpdir(), "yoto-progress-"))
    try {
        const bindings = createBindings(createMockEnv(), directory)
        expect(bindings.IMPORT_PROGRESS.getByName("initial")).toBe(
            bindings.IMPORT_PROGRESS.getByName("initial"),
        )
        const store = new ProgressStore(directory)
        await store
            .forImport("pending")
            .put("event", {type: "progress", percent: 20})
        await store
            .forImport("complete")
            .put("event", {type: "complete", success: true})
        const restarted = new ProgressStore(directory)
        await expect(
            restarted.forImport("pending").get("event"),
        ).resolves.toEqual({
            type: "error",
            error: "Import interrupted by server restart",
        })
        await expect(
            restarted.forImport("complete").get("event"),
        ).resolves.toEqual({type: "complete", success: true})
        const reloadedBindings = createBindings(createMockEnv(), directory)
        const failed = await reloadedBindings.IMPORT_WORKFLOW.get("pending")
        expect((await failed.status()).status).toBe("errored")
        const completed = await reloadedBindings.IMPORT_WORKFLOW.get("complete")
        expect((await completed.status()).status).toBe("complete")
        const progress = new ImportProgress(
            {
                storage: restarted.forImport("pending"),
            } as unknown as DurableObjectState,
            createMockEnv(),
        )
        const response = await progress.fetch(
            new Request("https://example.com/events", {
                headers: {"X-Import-Id": "pending"},
            }),
        )
        expect(await response.text()).toContain(
            "Import interrupted by server restart",
        )
    } finally {
        await rm(directory, {recursive: true, force: true})
    }
})
