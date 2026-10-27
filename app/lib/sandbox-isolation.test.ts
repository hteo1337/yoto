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
})
