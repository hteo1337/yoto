import {
    mkdirSync,
    readdirSync,
    readFileSync,
    renameSync,
    writeFileSync,
} from "node:fs"
import {join} from "node:path"

import type {ImportStreamEvent} from "../../app/lib/import"
import {sandboxDirectory} from "./sandbox"
import type {Storage} from "./workers"

export class ProgressStore {
    constructor(private directory: string) {
        mkdirSync(directory, {recursive: true, mode: 0o700})
        for (const file of readdirSync(directory)) {
            if (!file.endsWith(".json")) continue
            const id = file.slice(0, -5)
            const record = this.read(id)
            const event = record.event as ImportStreamEvent | undefined
            if (
                !event ||
                (event.type !== "error" && event.type !== "complete")
            ) {
                this.write(id, {
                    ...record,
                    event: {
                        type: "error",
                        error: "Import interrupted by server restart",
                    },
                })
            }
        }
    }

    private filename(id: string): string {
        sandboxDirectory(id)
        return join(this.directory, `${id}.json`)
    }

    private read(id: string): Record<string, unknown> {
        try {
            return JSON.parse(readFileSync(this.filename(id), "utf8"))
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}
            throw error
        }
    }

    private write(id: string, record: Record<string, unknown>): void {
        const filename = this.filename(id)
        writeFileSync(`${filename}.tmp`, JSON.stringify(record), {mode: 0o600})
        renameSync(`${filename}.tmp`, filename)
    }

    forImport(id: string): Storage {
        this.filename(id)
        return {
            get: async <T>(key: string) => this.read(id)[key] as T | undefined,
            put: async (key, value) => {
                const record = {...this.read(id), [key]: value}
                this.write(id, record)
            },
        }
    }
}
