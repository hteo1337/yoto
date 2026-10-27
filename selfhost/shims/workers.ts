import {AsyncLocalStorage} from "node:async_hooks"
import http, {type ClientRequest} from "node:http"
import https from "node:https"
import {syncBuiltinESMExports} from "node:module"
import {setTimeout as delay} from "node:timers/promises"

// Auth helpers also import Cloudflare's module-level env directly.
export const env = {
    get YOTO_CLIENT_ID() {
        return process.env.YOTO_CLIENT_ID
    },
    get YOTO_AUTH_SECRET() {
        return process.env.YOTO_AUTH_SECRET
    },
}

const execution = new AsyncLocalStorage<AbortSignal>()
export const currentSignal = () => execution.getStore()

export type WorkflowEvent<T> = {payload: T; timestamp: Date}
type StepOptions = {
    retries: {limit: number; delay: string | number; backoff?: string}
    timeout: string | number
}

function milliseconds(value: string | number): number {
    if (typeof value === "number") return value
    const match =
        /^(\d+(?:\.\d+)?)\s*(milliseconds?|seconds?|minutes?|hours?)$/.exec(
            value,
        )
    if (!match) throw new Error(`Invalid workflow duration: ${value}`)
    const unit = match[2]
    return (
        Number(match[1]) *
        (unit.startsWith("hour")
            ? 3600000
            : unit.startsWith("minute")
              ? 60000
              : unit.startsWith("second")
                ? 1000
                : 1)
    )
}

export class WorkflowStep {
    async do<T>(
        _name: string,
        options: StepOptions,
        callback: () => Promise<T>,
    ): Promise<T> {
        const {limit, delay: retryDelay, backoff} = options.retries
        for (let attempt = 0; ; attempt++) {
            const controller = new AbortController()
            let timer: ReturnType<typeof setTimeout> | undefined
            try {
                return await execution.run(controller.signal, () =>
                    Promise.race([
                        Promise.resolve().then(callback),
                        new Promise<never>((_resolve, reject) => {
                            timer = setTimeout(() => {
                                const error = new Error(
                                    "Workflow step timed out",
                                )
                                controller.abort(error)
                                reject(error)
                            }, milliseconds(options.timeout))
                        }),
                    ]),
                )
            } catch (error) {
                if (attempt >= limit) throw error
            } finally {
                clearTimeout(timer)
            }
            const factor =
                backoff === "exponential"
                    ? 2 ** attempt
                    : backoff === "linear"
                      ? attempt + 1
                      : 1
            await delay(milliseconds(retryDelay) * factor)
        }
    }
}

// SDK uses Axios HTTP; other helpers use fetch. Both inherit step deadlines,
// including calls made after a timed-out callback resumes.
export function installFetchDeadline(): void {
    for (const transport of [http, https]) {
        for (const method of ["request", "get"] as const) {
            transport[method] = new Proxy(transport[method], {
                apply(target, thisArg, args) {
                    const signal = currentSignal()
                    signal?.throwIfAborted()
                    const request = Reflect.apply(
                        target,
                        thisArg,
                        args,
                    ) as ClientRequest
                    if (signal) {
                        const abort = () =>
                            request.destroy(
                                new Error("Workflow step timed out"),
                            )
                        signal.addEventListener("abort", abort, {once: true})
                        request.once("close", () =>
                            signal.removeEventListener("abort", abort),
                        )
                    }
                    return request
                },
            })
        }
    }
    syncBuiltinESMExports()
    const original = globalThis.fetch
    globalThis.fetch = (input, init) => {
        const signal = currentSignal()
        if (!signal) return original(input, init)
        signal.throwIfAborted()
        const supplied =
            init?.signal ??
            (input instanceof Request ? input.signal : undefined)
        return original(input, {
            ...init,
            signal: supplied ? AbortSignal.any([signal, supplied]) : signal,
        })
    }
}

export class WorkflowEntrypoint<E, P> {
    constructor(
        protected ctx: unknown,
        protected env: E,
    ) {}
    async run(_event: WorkflowEvent<P>, _step: WorkflowStep): Promise<unknown> {
        void _event
        void _step
        throw new Error("Workflow must implement run")
    }
}

export type Storage = {
    get<T>(key: string): Promise<T | undefined>
    put(key: string, value: unknown): Promise<void>
}

export class DurableObject<E> {
    constructor(
        protected ctx: {storage: Storage},
        protected env: E,
    ) {}
}
