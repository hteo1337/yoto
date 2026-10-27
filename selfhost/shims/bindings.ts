import pLimit from "p-limit"

import type {
    ImportStreamEvent,
    ImportWorkflowParams,
} from "../../app/lib/import"
import {logger} from "../../app/lib/logger.server"
import {ImportProgress} from "../../workers/import-progress"
import {ImportWorkflow} from "../../workers/import-workflow"
import {ProgressStore} from "./storage"
import {currentSignal, WorkflowStep} from "./workers"

export function createBindings(
    env: {
        YOTO_CLIENT_ID: string
        YOTO_AUTH_SECRET: string
        RESEND_API_KEY: string
    },
    directory: string,
): Env {
    const store = new ProgressStore(directory)
    const instances = new Map<string, ImportProgress>()
    const running = new Set<string>()
    const limit = pLimit(3)
    const bindings = {
        ...env,
        SANDBOX: {},
        IMPORT_PROGRESS: {
            getByName(id: string) {
                currentSignal()?.throwIfAborted()
                let instance = instances.get(id)
                if (!instance) {
                    const storage = store.forImport(id)
                    instance = new ImportProgress(
                        {
                            storage: {
                                ...storage,
                                put: async (
                                    key: string,
                                    value: {type?: string},
                                ) => {
                                    currentSignal()?.throwIfAborted()
                                    await storage.put(key, value)
                                    if (
                                        value.type === "complete" ||
                                        value.type === "error"
                                    )
                                        instances.delete(id)
                                },
                            },
                        } as unknown as DurableObjectState,
                        bindings as unknown as Env,
                    )
                    instances.set(id, instance)
                }
                return instance
            },
        },
        IMPORT_WORKFLOW: {
            async get(id: string) {
                const storage = store.forImport(id)
                if (!(await storage.get("event")))
                    throw new Error("Unknown import ID")
                return {
                    status: async () => {
                        const event =
                            await storage.get<ImportStreamEvent>("event")
                        if (event?.type === "error")
                            return {
                                status: "errored",
                                error: {name: "Error", message: event.error},
                            }
                        if (event?.type === "complete")
                            return {
                                status: "complete",
                                output: {
                                    importId: id,
                                    status: "success",
                                    message: event.message,
                                    added: event.added,
                                    skipped: event.skipped,
                                    ...(event.description
                                        ? {description: event.description}
                                        : {}),
                                },
                            }
                        return {status: running.has(id) ? "running" : "queued"}
                    },
                }
            },
            async create({
                id,
                params,
            }: {
                id: string
                params: ImportWorkflowParams
            }) {
                const storage = store.forImport(id)
                if ((await storage.get("event")) || running.has(id))
                    throw new Error("Import ID already exists")
                // Persist queued work before acknowledging it, including before first progress.
                running.add(id)
                try {
                    await storage.put("event", {
                        type: "progress",
                        phase: "preparing",
                        percent: 0,
                        total: 0,
                        prepared: 0,
                        uploaded: 0,
                        ready: 0,
                    })
                } catch (error) {
                    running.delete(id)
                    throw error
                }
                const event = {
                    payload: params,
                    timestamp: new Date(),
                } as Parameters<ImportWorkflow["run"]>[0]
                void limit(async () => {
                    try {
                        const workflow = new ImportWorkflow(
                            {} as ExecutionContext,
                            bindings as unknown as Env,
                        )
                        await workflow.run(
                            event,
                            new WorkflowStep() as unknown as Parameters<
                                ImportWorkflow["run"]
                            >[1],
                        )
                    } catch {
                        const latest = await storage.get<{type: string}>(
                            "event",
                        )
                        if (
                            latest?.type !== "error" &&
                            latest?.type !== "complete"
                        ) {
                            await bindings.IMPORT_PROGRESS.getByName(
                                id,
                            ).reportError(
                                "Import failed; see server logs for details",
                            )
                        }
                        logger.error({
                            message: "selfhost.workflow.failed",
                            importId: id,
                        })
                    } finally {
                        running.delete(id)
                    }
                }).catch(() =>
                    logger.error({
                        message: "selfhost.progress.persist_failed",
                        importId: id,
                    }),
                )
                return {id}
            },
        },
    }
    return bindings as unknown as Env
}
