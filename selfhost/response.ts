import {Readable, type Writable} from "node:stream"
import {pipeline} from "node:stream/promises"

export async function forwardBody(
    body: ReadableStream<Uint8Array>,
    destination: Writable,
): Promise<void> {
    await pipeline(
        Readable.fromWeb(
            body as unknown as import("node:stream/web").ReadableStream,
        ),
        destination,
    )
}
