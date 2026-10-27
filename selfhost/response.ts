import {Readable, type Writable} from "node:stream"
import {pipeline} from "node:stream/promises"
import type {ReadableStream as NodeReadableStream} from "node:stream/web"

export async function forwardBody(
    body: ReadableStream<Uint8Array>,
    destination: Writable,
): Promise<void> {
    await pipeline(
        Readable.fromWeb(body as unknown as NodeReadableStream),
        destination,
    )
}
