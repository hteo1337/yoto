import {mkdtemp, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"

import {ProgressStore} from "../../selfhost/shims/storage"
import {getSandbox as nodeSandbox} from "../../selfhost/shims/sandbox"
import {WorkflowStep} from "../../selfhost/shims/workers"
import {ImportProgress} from "../../workers/import-progress"
import {expect, it, vi} from "vitest"

import {createMockEnv} from "~/tests/mocks"

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
    const directory = await mkdtemp(join(tmpdir(), "yoto-progress-"))
    try {
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
