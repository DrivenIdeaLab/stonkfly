"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls by re-fetching server components. Cheap, cache-safe, and enough for a
 * 60 s observation cadence. Replace with the observer's WebSocket (or SSE)
 * stream when sub-second updates are needed — see the runbook.
 */
export function LiveRefresher({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [enabled, router, seconds]);

  return (
    <button
      type="button"
      onClick={() => setEnabled((value) => !value)}
      className="chip cursor-pointer transition-colors hover:border-cyan/40 hover:text-ink"
      title={enabled ? "Pause automatic refresh" : "Resume automatic refresh"}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-emerald" : "bg-ink-3"}`}
      />
      {enabled ? `auto ${seconds}s` : "paused"}
    </button>
  );
}
