"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Live push, with honest degradation:
 *   live      — SSE connected, ticks arriving
 *   reconnecting — observer unreachable; exponential backoff (1s→15s capped)
 *   polling   — stream gave nothing for 90s; fall back to a 15s router.refresh()
 *   paused    — the user paused; nothing runs
 *
 * On every received tick the server components are refreshed, so the page
 * updates without a reload. The pause control from the poller era is kept.
 */

type ConnState = "connecting" | "live" | "reconnecting" | "polling" | "paused";

const STALL_FALLBACK_MS = 90_000;
const POLL_MS = 15_000;

export function LiveRefresher({ seconds = 15, run = "paper" }: { seconds?: number; run?: string }) {
  const router = useRouter();
  const [state, setState] = useState<ConnState>("connecting");
  const [lastTick, setLastTick] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const lastMessageRef = useRef(Date.now());

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (paused) {
      setState("paused");
      return;
    }

    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let stallTimer: ReturnType<typeof setInterval> | null = null;
    let retryMs = 1000;
    let disposed = false;

    const startPolling = () => {
      if (pollTimer) return;
      setState("polling");
      refresh();
      pollTimer = setInterval(refresh, POLL_MS);
    };

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const connect = () => {
      if (disposed) return;
      setState((s) => (s === "paused" ? s : "reconnecting"));
      es = new EventSource(`/api/stream?run=${encodeURIComponent(run)}`);

      es.addEventListener("open", () => {
        retryMs = 1000;
      });
      es.addEventListener("up", () => {
        stopPolling();
        lastMessageRef.current = Date.now();
        setState("live");
      });
      es.addEventListener("ticks", (event) => {
        lastMessageRef.current = Date.now();
        try {
          const data = JSON.parse((event as MessageEvent).data) as { events: { tick: number }[] };
          const newest = data.events.at(-1)?.tick ?? null;
          setLastTick(newest);
        } catch {
          /* ignore malformed */
        }
        refresh();
      });
      es.addEventListener("down", () => {
        lastMessageRef.current = Date.now();
        setState("reconnecting");
      });
      es.onerror = () => {
        es?.close();
        es = null;
        if (disposed) return;
        // EventSource would retry itself, but we own the backoff.
        setTimeout(connect, retryMs);
        retryMs = Math.min(15000, retryMs * 2);
      };

      // If the stream connects but nothing arrives for a while, poll instead
      // of staring at a silent connection (never silently stale).
      stallTimer = setInterval(() => {
        if (Date.now() - lastMessageRef.current > STALL_FALLBACK_MS) {
          es?.close();
          es = null;
          startPolling();
        }
      }, 10_000);
    };

    connect();

    return () => {
      disposed = true;
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
      if (stallTimer) clearInterval(stallTimer);
    };
  }, [paused, refresh, run]);

  const tone =
    state === "live"
      ? { dot: "bg-emerald", text: "text-emerald", label: lastTick !== null ? `live · tick ${lastTick}` : "live" }
      : state === "reconnecting"
        ? { dot: "bg-amber", text: "text-amber", label: "reconnecting" }
        : state === "polling"
          ? { dot: "bg-amber", text: "text-amber", label: `polling ${seconds}s` }
          : state === "paused"
            ? { dot: "bg-ink-3", text: "text-ink-3", label: "paused" }
            : { dot: "bg-ink-3", text: "text-ink-3", label: "connecting" };

  return (
    <button
      type="button"
      onClick={() => setPaused((value) => !value)}
      className="chip cursor-pointer transition-colors hover:border-cyan/40 hover:text-ink"
      title={
        paused
          ? "Resume live updates"
          : state === "live"
            ? "Live push active — click to pause"
            : `Connection state: ${state} — click to pause`
      }
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot} ${state === "live" ? "heartbeat" : ""}`} />
      <span className={tone.text}>{tone.label}</span>
    </button>
  );
}
