"use client";

import { useEffect, useState } from "react";

import { ago } from "@/lib/format";
import { liveness } from "@/lib/derive";

/**
 * A headless experiment's classic failure is dying silently, so liveness is a
 * first-class readout: freshness of the newest observation, not process state.
 */
export function Heartbeat({ lastTickAt, synthetic }: { lastTickAt: number | null; synthetic: boolean }) {
  const [, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { state, seconds } = liveness(lastTickAt);
  const tone =
    synthetic
      ? { dot: "bg-ink-3", text: "text-ink-3", label: "fixture" }
      : state === "live"
        ? { dot: "bg-emerald", text: "text-emerald", label: "streaming" }
        : state === "stale"
          ? { dot: "bg-amber", text: "text-amber", label: "stale" }
          : { dot: "bg-rose", text: "text-rose", label: "stopped" };

  return (
    <span
      className={`chip ${state === "stopped" && !synthetic ? "chip-rose" : state === "stale" ? "chip-amber" : ""}`}
      title={
        lastTickAt === null
          ? "No observations yet"
          : `Newest observation ${ago(lastTickAt)} (${Math.round(seconds)}s ago)`
      }
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        {state === "live" && !synthetic ? (
          <span className={`heartbeat absolute inline-flex h-2 w-2 rounded-full ${tone.dot}`} />
        ) : null}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      </span>
      <span className={tone.text}>{tone.label}</span>
    </span>
  );
}
