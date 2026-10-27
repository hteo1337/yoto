import {resolve} from "node:path"

import {
    createReadableStreamFromReadable,
    writeReadableStreamToWritable,
} from "@react-router/node"
import express from "express"
import {createRequestHandler, RouterContextProvider} from "react-router"

import {cloudflareContext} from "../app/lib/cloudflare-context"
import {logger} from "../app/lib/logger.server"
import {createBindings} from "./shims/bindings"
import {installFetchDeadline} from "./shims/workers"

function required(name: string): string {
    const value = process.env[name]
    if (!value?.trim())
        throw new Error(`Missing required environment variable: ${name}`)
    return value
}

const origin = new URL(required("PUBLIC_ORIGIN"))
if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
) {
    throw new Error(
        "PUBLIC_ORIGIN must be an HTTP(S) origin without a path or credentials",
    )
}
if (
    origin.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
) {
    throw new Error(
        "PUBLIC_ORIGIN requires HTTPS except for localhost smoke checks",
    )
}
const env = createBindings(
    {
        YOTO_CLIENT_ID: required("YOTO_CLIENT_ID"),
        YOTO_AUTH_SECRET: required("YOTO_AUTH_SECRET"),
        RESEND_API_KEY: required("RESEND_API_KEY"),
    },
    process.env.PROGRESS_DIR ?? "/data/progress",
)
installFetchDeadline()
const handler = createRequestHandler(
    () => import("virtual:react-router/server-build"),
    "production",
)
const app = express()
app.disable("x-powered-by")
app.get("/healthz", (_request, response) => response.status(200).send("ok"))
app.use(express.static(resolve("build-selfhost/client"), {index: false}))
app.use(async (incoming, outgoing) => {
    const abort = new AbortController()
    outgoing.on("close", () => abort.abort())
    try {
        // Resolve only the incoming path/query; never accept its host or proxy headers.
        const path = new URL(incoming.originalUrl, "http://localhost")
        const url = new URL(origin.origin)
        url.pathname = path.pathname
        url.search = path.search
        const headers = new Headers()
        for (const [name, value] of Object.entries(incoming.headers)) {
            if (
                !value ||
                name === "forwarded" ||
                name.startsWith("x-forwarded-")
            )
                continue
            for (const entry of Array.isArray(value) ? value : [value])
                headers.append(name, entry)
        }
        headers.set("host", origin.host)
        const hasBody = incoming.method !== "GET" && incoming.method !== "HEAD"
        const request = new Request(url, {
            method: incoming.method,
            headers,
            signal: abort.signal,
            ...(hasBody
                ? {
                      body: createReadableStreamFromReadable(incoming),
                      duplex: "half",
                  }
                : {}),
        } as RequestInit)
        const context = new RouterContextProvider()
        context.set(cloudflareContext, {env, ctx: {} as ExecutionContext})
        const response = await handler(request, context)
        outgoing.status(response.status)
        for (const [name, value] of response.headers) {
            if (name !== "set-cookie") outgoing.setHeader(name, value)
        }
        const cookies = response.headers.getSetCookie()
        if (cookies.length) outgoing.setHeader("Set-Cookie", cookies)
        if (response.body && incoming.method !== "HEAD") {
            await writeReadableStreamToWritable(response.body, outgoing)
        } else outgoing.end()
    } catch {
        if (!abort.signal.aborted) {
            logger.error({message: "selfhost.request.failed"})
            if (!outgoing.headersSent)
                outgoing.status(500).send("Internal server error")
            else outgoing.destroy()
        }
    }
})
const port = Number(process.env.PORT ?? 3000)
if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT")
const server = app.listen(port, "0.0.0.0", () =>
    logger.info({message: "selfhost.server.started", port}),
)
for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
        server.close(() => process.exit(0))
        setTimeout(() => process.exit(0), 10000).unref()
    })
}
