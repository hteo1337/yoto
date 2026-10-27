import {spawn, type ChildProcess} from "node:child_process"
import {rm} from "node:fs/promises"

import {currentSignal} from "./workers"

const killed = new WeakSet<ChildProcess>()
const active = new Map<string, Set<ChildProcess>>()
const OUTPUT_LIMIT = 8 * 1024 * 1024

export function sandboxDirectory(id: string): string {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
        throw new Error("Invalid sandbox ID")
    return `/tmp/yoto/${id}`
}

function kill(child: ChildProcess): void {
    if (!child.pid || killed.has(child)) return
    try {
        process.kill(-child.pid, "SIGKILL")
        killed.add(child)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error
    }
}

export function getSandbox(_binding: unknown, id: string) {
    const directory = sandboxDirectory(id)
    return {
        exec(command: string, options?: {env?: Record<string, string>}) {
            const signal = currentSignal()
            signal?.throwIfAborted()
            return new Promise<{
                success: boolean
                stdout: string
                stderr: string
            }>(resolve => {
                const child = spawn("bash", ["-c", command], {
                    detached: true,
                    env: {
                        PATH: "/opt/yt-dlp/bin:/usr/local/bin:/usr/bin:/bin",
                        HOME: "/tmp",
                        LANG: "C.UTF-8",
                        ...options?.env,
                    } as unknown as NodeJS.ProcessEnv,
                    stdio: ["ignore", "pipe", "pipe"],
                })
                const children = active.get(id) ?? new Set<ChildProcess>()
                active.set(id, children)
                children.add(child)
                let stdout = ""
                let stderr = ""
                let bytes = 0
                let failure: string | undefined
                const stop = (reason: string) => {
                    failure = reason
                    kill(child)
                }
                const abort = () => stop("Workflow step aborted")
                const timer = setTimeout(
                    () => stop("Sandbox command timed out"),
                    30 * 60 * 1000,
                )
                signal?.addEventListener("abort", abort, {once: true})
                const collect = (
                    chunk: Buffer,
                    output: "stdout" | "stderr",
                ) => {
                    bytes += chunk.length
                    if (bytes > OUTPUT_LIMIT)
                        return stop("Sandbox output limit exceeded")
                    if (output === "stdout") stdout += chunk.toString()
                    else stderr += chunk.toString()
                }
                child.stdout.on("data", chunk => collect(chunk, "stdout"))
                child.stderr.on("data", chunk => collect(chunk, "stderr"))
                child.on("error", () => {
                    failure = "Could not start sandbox command"
                })
                child.on("close", code => {
                    clearTimeout(timer)
                    signal?.removeEventListener("abort", abort)
                    // A shell may exit before its descendants; remove the whole group.
                    kill(child)
                    children.delete(child)
                    if (!children.size) active.delete(id)
                    resolve({
                        success: code === 0 && !failure,
                        stdout,
                        stderr: failure ?? stderr,
                    })
                })
            })
        },
        async destroy() {
            const children = [...(active.get(id) ?? [])]
            await Promise.all(
                children.map(
                    child =>
                        new Promise<void>(resolve => {
                            child.once("close", resolve)
                            kill(child)
                        }),
                ),
            )
            await rm(directory, {recursive: true, force: true})
        },
    }
}
