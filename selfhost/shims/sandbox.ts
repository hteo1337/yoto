import {type ChildProcess, spawn} from "node:child_process"
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

function kill(child: ChildProcess): string | undefined {
    if (!child.pid || killed.has(child)) return
    try {
        process.kill(-child.pid, "SIGKILL")
        killed.add(child)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") return
        // Group termination can fail on some hosts; never throw from callbacks.
        try {
            if (child.kill("SIGKILL")) return
        } catch {
            // Report both termination failures through the exec lifecycle.
        }
        return "Could not terminate sandbox command"
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
                    failure ??= reason
                    if (kill(child)) finish(null)
                }
                const abort = () => stop("Workflow step aborted")
                const timer = setTimeout(
                    () => stop("Sandbox command timed out"),
                    30 * 60 * 1000,
                )
                signal?.addEventListener("abort", abort, {once: true})
                const finish = (code: number | null) => {
                    clearTimeout(timer)
                    signal?.removeEventListener("abort", abort)
                    resolve({
                        success: code === 0 && !failure,
                        stdout,
                        stderr: failure ?? stderr,
                    })
                }
                const collect = (
                    chunk: Buffer,
                    output: "stdout" | "stderr",
                ) => {
                    bytes += Buffer.byteLength(chunk)
                    if (bytes > OUTPUT_LIMIT)
                        return stop("Sandbox output limit exceeded")
                    if (output === "stdout") stdout += chunk
                    else stderr += chunk
                }
                child.stdout.setEncoding("utf8")
                child.stderr.setEncoding("utf8")
                child.stdout.on("data", chunk => collect(chunk, "stdout"))
                child.stderr.on("data", chunk => collect(chunk, "stderr"))
                child.on("error", () => {
                    failure = "Could not start sandbox command"
                })
                child.on("close", code => {
                    // A shell may exit before its descendants; remove the whole group.
                    const terminationFailure = kill(child)
                    failure ??= terminationFailure
                    children.delete(child)
                    if (!children.size) active.delete(id)
                    finish(code)
                })
            })
        },
        async destroy() {
            const children = [...(active.get(id) ?? [])]
            await Promise.all(
                children.map(
                    child =>
                        new Promise<void>((resolve, reject) => {
                            child.once("close", resolve)
                            const failure = kill(child)
                            if (failure) reject(new Error(failure))
                        }),
                ),
            )
            await rm(directory, {recursive: true, force: true})
        },
    }
}
