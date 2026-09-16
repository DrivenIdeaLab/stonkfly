import type { TickEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events bridge: observer WebSocket -> browser EventSource.
 *
 * Why SSE on this leg: EventSource reconnects natively, works same-origin
 * through NPM with basic auth, and needs no custom Next server. The
 * X-Accel-Buffering header tells Nginx not to buffer the stream.
 *
 * Read-only: this route only ever connects OUT to the observer and streams
 * what it receives. It accepts no input and writes nothing anywhere.
 */

const RECONNECT_MS = 3000; // EventSource retry hint
const HELLO_TIMEOUT_MS = 8000; // if no observer hello by then, it's down

export async function GET(request: Request) {
  const run = new URL(request.url).searchParams.get("run") ?? "paper";
  const observer = process.env.STONKFLY_OBSERVER_URL ?? "http://127.0.0.1:8787";

  const encoder = new TextEncoder();
  let ws: WebSocket | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      send("open", { observer, run, retry: RECONNECT_MS });

      const connectReal = (attempt: number) => {
        if (closed) return;
        let opened = false;
        let done = false;
        const fail = (detail?: string) => {
          if (done || closed) return;
          done = true;
          send("down", detail ? { detail, attempt } : { attempt });
          scheduleReconnect(attempt);
        };
        const url = observer.replace(/^http/, "ws") + "/ws";
        try {
          ws = new WebSocket(url);
        } catch {
          fail("observer URL invalid");
          return;
        }
        // A socket that never finishes handshaking (e.g. a firewalled DROP)
        // emits no events at all — so the attempt must time itself out and
        // schedule its own retry. Never depend on onclose firing.
        const helloTimer = setTimeout(() => {
          if (!opened) {
            try { ws?.close(); } catch { /* ignore */ }
            fail("observer handshake timeout");
          }
        }, HELLO_TIMEOUT_MS);

        ws.onopen = () => {
          opened = true;
          clearTimeout(helloTimer);
          send("up", { attempt });
        };
        ws.onmessage = (message) => {
          try {
            const parsed = JSON.parse(String(message.data)) as {
              type: string;
              version?: string;
              run?: string;
              events?: TickEvent[];
            };
            if (parsed.type === "hello") {
              send("up", { observerVersion: parsed.version ?? null, attempt });
            } else if (parsed.type === "ticks" && parsed.run && parsed.events) {
              if (parsed.run === run) {
                send("ticks", { run: parsed.run, events: parsed.events });
              }
            }
          } catch {
            /* a malformed frame never kills the stream */
          }
        };
        ws.onclose = () => {
          clearTimeout(helloTimer);
          if (opened) {
            // a live connection was lost — reconnect with backoff
            send("down", { attempt });
            scheduleReconnect(attempt);
          } else {
            // the attempt failed before opening (refused, reset, DNS…)
            fail();
          }
        };
        ws.onerror = () => {
          clearTimeout(helloTimer);
        };
      };

      const scheduleReconnect = (attempt: number) => {
        // Exponential backoff, capped: 1s, 2s, 4s, 8s, 15s, 15s...
        const delay = Math.min(15000, 1000 * 2 ** attempt);
        setTimeout(() => connectReal(attempt + 1), delay);
      };

      connectReal(0);

      request.signal.addEventListener("abort", () => {
        closed = true;
        try { ws?.close(); } catch { /* ignore */ }
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      closed = true;
      try { ws?.close(); } catch { /* ignore */ }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
