import {access, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises"
import {tmpdir} from "node:os"
import {dirname, join} from "node:path"

import {expect, it} from "vitest"

import {sandboxDirectory} from "./sandbox"
import {ProgressStore} from "./storage"

it("reclaims interrupted import scratch while preserving replay and unrelated paths", async () => {
    const directory = await mkdtemp(join(tmpdir(), "yoto-recovery-"))
    const id = crypto.randomUUID()
    const scratch = sandboxDirectory(`import-${id}`)
    const sentinel = join(dirname(scratch), `outside-${id}`)
    const complete = {
        type: "complete",
        message: "Imported",
        added: 1,
        skipped: 0,
    }
    const error = {type: "error", error: "Previous failure"}
    try {
        const store = new ProgressStore(directory)
        await store.forImport(id).put("event", {
            type: "progress",
            phase: "importing",
            percent: 20,
        })
        await store.forImport(`complete-${id}`).put("event", complete)
        await store.forImport(`error-${id}`).put("event", error)
        await mkdir(scratch, {recursive: true})
        await writeFile(join(scratch, "x.part"), "interrupted audio")
        await writeFile(sentinel, "keep")

        const recovered = new ProgressStore(directory)
        const terminal = {
            type: "error",
            error: "Import interrupted by server restart",
        }
        await expect(recovered.forImport(id).get("event")).resolves.toEqual(
            terminal,
        )
        expect(
            JSON.parse(await readFile(join(directory, `${id}.json`), "utf8"))
                .event,
        ).toEqual(terminal)
        await expect(access(scratch)).rejects.toMatchObject({code: "ENOENT"})
        expect(await readFile(sentinel, "utf8")).toBe("keep")
        await expect(
            recovered.forImport(`complete-${id}`).get("event"),
        ).resolves.toEqual(complete)
        await expect(
            recovered.forImport(`error-${id}`).get("event"),
        ).resolves.toEqual(error)
    } finally {
        await rm(scratch, {recursive: true, force: true})
        await rm(sentinel, {force: true})
        await rm(directory, {recursive: true, force: true})
    }
})
