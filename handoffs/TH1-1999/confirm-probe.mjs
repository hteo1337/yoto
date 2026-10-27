// Scoped confirmation of the existing adversarial repro; no accounts or sidecar.
import assert from "node:assert/strict"
import {spawn, execFileSync} from "node:child_process"
import {once} from "node:events"
import {access, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises"
import http from "node:http"
import {tmpdir} from "node:os"
import {join, resolve} from "node:path"
import {pathToFileURL} from "node:url"
import {build} from "esbuild"

const artifacts = resolve("handoffs/TH1-1999")
const scratch = join(artifacts, ".confirm-scratch")
await mkdir(scratch, {recursive: true})
const shims = resolve("selfhost/shims")
await build({
    stdin: {
        contents:
            'export {ProgressStore} from "./storage"; export {getSandbox, sandboxDirectory} from "./sandbox"',
        resolveDir: shims,
        loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(scratch, "head.mjs"),
})
const baselineDir = join(scratch, "baseline")
await mkdir(baselineDir, {recursive: true})
for (const file of ["storage.ts", "sandbox.ts", "workers.ts"]) {
    await writeFile(
        join(baselineDir, file),
        execFileSync("git", ["show", `4a72f76:selfhost/shims/${file}`]),
    )
}
await build({
    entryPoints: [join(baselineDir, "storage.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(scratch, "baseline.mjs"),
})
const {ProgressStore, getSandbox, sandboxDirectory} = await import(
    pathToFileURL(join(scratch, "head.mjs"))
)
const {ProgressStore: BaselineStore} = await import(
    pathToFileURL(join(scratch, "baseline.mjs"))
)
const root = await mkdtemp(join(tmpdir(), "yoto-fix-confirm-"))
const id = crypto.randomUUID()
const owned = sandboxDirectory(`import-${id}`)
const sentinel = sandboxDirectory(`outside-${id}`)
const sandbox = getSandbox(null, `cap-${id}`)
let server
try {
    const progress = join(root, "progress")
    const store = new ProgressStore(progress)
    await store
        .forImport(id)
        .put("event", {type: "progress", phase: "importing", percent: 20})
    await store
        .forImport(`complete-${id}`)
        .put("event", {
            type: "complete",
            message: "Imported",
            added: 1,
            skipped: 0,
        })
    await store
        .forImport(`error-${id}`)
        .put("event", {type: "error", error: "Previous failure"})
    const replay = await Promise.all(
        ["complete", "error"].map(kind =>
            readFile(join(progress, `${kind}-${id}.json`), "utf8"),
        ),
    )
    await mkdir(owned, {recursive: true})
    await writeFile(join(owned, "download.m4a.part"), "orphaned audio")
    await writeFile(sentinel, "outside-control")
    const socket = http.createServer()
    await new Promise(resolve => socket.listen(0, "127.0.0.1", resolve))
    const port = socket.address().port
    await new Promise(resolve => socket.close(resolve))
    server = spawn(
        process.execPath,
        [resolve("build-selfhost/server/index.js")],
        {
            env: {
                PATH: process.env.PATH,
                PUBLIC_ORIGIN: "https://review.example.ts.net",
                YOTO_CLIENT_ID: "synthetic-client",
                YOTO_AUTH_SECRET: "synthetic-test-only",
                RESEND_API_KEY: "synthetic-unused",
                PROGRESS_DIR: progress,
                PORT: String(port),
                NODE_ENV: "production",
            },
            stdio: ["ignore", "pipe", "pipe"],
        },
    )
    let logs = ""
    server.stdout.on("data", chunk => {
        logs += chunk
    })
    server.stderr.on("data", chunk => {
        logs += chunk
    })
    let healthy = false
    for (let attempt = 0; attempt < 200; attempt++) {
        if (server.exitCode !== null)
            throw new Error(`server exited ${server.exitCode}: ${logs}`)
        try {
            healthy =
                (await fetch(`http://127.0.0.1:${port}/healthz`)).status === 200
        } catch {}
        if (healthy) break
        await new Promise(resolve => setTimeout(resolve, 25))
    }
    assert.equal(healthy, true)
    const record = JSON.parse(
        await readFile(join(progress, `${id}.json`), "utf8"),
    )
    assert.deepEqual(record.event, {
        type: "error",
        error: "Import interrupted by server restart",
    })
    const scratchSurvives = await access(join(owned, "download.m4a.part")).then(
        () => true,
        () => false,
    )
    assert.equal(
        scratchSurvives,
        false,
        "startup must reclaim scratch for terminal interrupted imports",
    )
    const after = await Promise.all(
        ["complete", "error"].map(kind =>
            readFile(join(progress, `${kind}-${id}.json`), "utf8"),
        ),
    )
    assert.deepEqual(after, replay)
    assert.equal(await readFile(sentinel, "utf8"), "outside-control")
    console.log(
        "PROBE startup: health=200 terminalError=true interruptedScratchSurvives=false completeReplayUnchanged=true errorReplayUnchanged=true outsideSentinelPreserved=true",
    )
    const closed = once(server, "exit")
    server.kill("SIGTERM")
    await closed
    server = undefined

    assert.deepEqual(await sandbox.exec("printf small"), {
        success: true,
        stdout: "small",
        stderr: "",
    })
    const started = performance.now()
    const oversized = await sandbox.exec("head -c 8388609 /dev/zero")
    assert.equal(oversized.success, false)
    assert.equal(oversized.stderr, "Sandbox output limit exceeded")
    assert.ok(Buffer.byteLength(oversized.stdout) <= 8388608)
    console.log(
        `PROBE cap: small=success oversized=failure stderr=${JSON.stringify(oversized.stderr)} retainedBytes=${Buffer.byteLength(oversized.stdout)} durationMs=${Math.round(performance.now() - started)} unhandledExceptions=0`,
    )

    for (const [revision, Store] of [
        ["4a72f76", BaselineStore],
        ["0dc1855", ProgressStore],
    ]) {
        const directory = join(root, `malformed-${revision}`)
        await mkdir(directory)
        await writeFile(
            join(directory, "a.b.json"),
            JSON.stringify({
                event: {type: "progress", phase: "importing", percent: 20},
            }),
        )
        let failure
        try {
            new Store(directory)
        } catch (error) {
            failure = error
        }
        assert.equal(failure?.message, "Invalid sandbox ID")
        console.log(
            `PROBE malformed: revision=${revision} file=a.b.json constructor=throws error=${JSON.stringify(failure.message)}`,
        )
        console.log(failure.stack.split("\n").slice(1, 5).join("\n"))
    }
    console.log(
        "RESULT: both reviewed fixes confirmed; malformed filename boot failure reproduces on unchanged baseline, not a regression",
    )
} finally {
    if (server && server.exitCode === null) {
        const closed = once(server, "exit")
        server.kill("SIGTERM")
        await closed
    }
    await sandbox.destroy()
    await rm(owned, {recursive: true, force: true})
    await rm(sentinel, {force: true})
    await rm(root, {recursive: true, force: true})
    await rm(scratch, {recursive: true, force: true})
}
