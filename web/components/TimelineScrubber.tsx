"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import type { TickEvent } from "@/lib/types";
import { isFill, isVeto } from "@/lib/derive";
import { base, clockTime, decimal, shortReason, signed, usdc } from "@/lib/format";
import { Chip, KeyValue, Stat } from "@/components/ui";
import { EquityChart } from "@/components/charts";

/**
 * Scrub the run. Historical frames only exist if something archived them (the
 * app keeps the latest image only), so the frame panel degrades honestly.
 */
export function TimelineScrubber({
  events,
  frames,
  initial,
}: {
  events: TickEvent[];
  frames: Record<number, string | null>;
  initial: number;
}) {
  const [index, setIndex] = useState(events.length - 1);
  const trackRef = useRef<HTMLInputElement>(null);
  const event = events[Math.min(index, events.length - 1)];
  const frame = frames[event.tick] ?? null;

  const step = (delta: number) =>
    setIndex((current) => Math.max(0, Math.min(events.length - 1, current + delta)));

  // Keyboard navigation: arrows step, Shift+arrows jump 10, Home/End jump to
  // the ends. The range input is focusable, so this also serves keyboard-only
  // users; no preventDefault for keys we don't own.
  const onKeyDown = (keyEvent: ReactKeyboardEvent<HTMLInputElement>) => {
    if (keyEvent.key === "ArrowLeft") {
      keyEvent.preventDefault();
      step(keyEvent.shiftKey ? -10 : -1);
    } else if (keyEvent.key === "ArrowRight") {
      keyEvent.preventDefault();
      step(keyEvent.shiftKey ? 10 : 1);
    } else if (keyEvent.key === "Home") {
      keyEvent.preventDefault();
      setIndex(0);
    } else if (keyEvent.key === "End") {
      keyEvent.preventDefault();
      setIndex(events.length - 1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <EquityChart
          points={events.map((e) => ({
            tick: e.tick,
            t: e.wall_time,
            equity: Number(e.equity_usdc),
            delta: Number(e.pnl_delta_usdc),
            price: Number(e.quote.bid),
            difference: e.neural.difference_hz,
            gate: e.neural.gate_spikes,
            kc: e.neural.KC_spikes,
            changed: e.neural.memory.changed_edges,
            meanEfficacy: e.neural.memory.mean_efficacy,
            stimulus: e.neural.stimulus,
            side: e.neural.side,
            execution: e.execution,
          }))}
          initial={initial}
          height={260}
          selected={index}
        />
        <input
          ref={trackRef}
          type="range"
          min={0}
          max={events.length - 1}
          value={index}
          onChange={(change) => setIndex(Number(change.target.value))}
          onKeyDown={onKeyDown}
          className="mt-3 w-full accent-cyan"
          aria-label="Scrub observations (arrow keys step, Shift+arrows jump 10, Home/End for ends)"
        />
        <div className="mt-1 flex justify-between text-[0.7rem] text-ink-3">
          <span className="num">tick #{events[0].tick}</span>
          <span className="num">
            {index + 1} / {events.length}
          </span>
          <span className="num">tick #{events.at(-1)!.tick}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="frame-bezel">
            {frame ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={frame}
                alt={`Frame at tick ${event.tick}`}
                className="pixelated block aspect-[16/9] w-full"
              />
            ) : (
              <div className="flex aspect-[16/9] w-full items-center justify-center bg-void px-6 text-center text-[0.75rem] text-ink-3">
                Frame for tick #{event.tick} was not archived — only the newest frame is retained by
                the worker.
              </div>
            )}
            <span className="corner left-1.5 top-1.5 border-t border-l" />
            <span className="corner right-1.5 top-1.5 border-t border-r" />
            <span className="corner bottom-1.5 left-1.5 border-b border-l" />
            <span className="corner right-1.5 bottom-1.5 border-b border-r" />
          </div>
          <p className="mt-2 text-[0.7rem] text-ink-3">
            The chart as rendered at tick <span className="num">#{event.tick}</span> — {event.product}{" "}
            at {clockTime(event.wall_time)}. This image, not the price, is what the retina received.
          </p>
        </div>

        <div className="space-y-4">
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="panel-title">Tick #{event.tick}</span>
              <Chip tone={isFill(event.execution) ? "emerald" : isVeto(event.execution) ? "amber" : "neutral"}>
                {event.execution.status === "HOLD"
                  ? "hold"
                  : isVeto(event.execution)
                    ? "vetoed"
                    : "filled"}
              </Chip>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Equity" value={usdc(event.equity_usdc, 4)} />
              <Stat
                label="Δ P&L"
                value={signed(event.pnl_delta_usdc, 4)}
                tone={Number(event.pnl_delta_usdc) > 0 ? "up" : Number(event.pnl_delta_usdc) < 0 ? "down" : "default"}
                align="right"
              />
            </div>
            <div className="mt-2">
              <KeyValue label="Proposal" value={event.neural.side} />
              <KeyValue label="Right − left" value={`${event.neural.difference_hz.toFixed(2)} Hz`} />
              <KeyValue label="Gate spikes" value={event.neural.gate_spikes} />
              <KeyValue label="Stimulus" value={event.neural.stimulus} />
              <KeyValue label="Filled size" value={event.execution.status === "FILLED" ? base(event.execution.base) : "—"} />
              <KeyValue
                label="Outcome"
                value={
                  isVeto(event.execution)
                    ? shortReason(event.execution.reason)
                    : event.execution.status
                }
                title={isVeto(event.execution) ? event.execution.reason : undefined}
              />
            </div>
          </div>

          <div className="panel p-4">
            <span className="panel-title">Provenance of this tick</span>
            <div className="mt-2">
              <KeyValue label="Input" value={decimal(String(event.neural.brain_ms), 0) + " ms neural"} />
              <KeyValue label="Compute" value={`${event.neural.compute_seconds.toFixed(2)} s`} />
              <KeyValue label="Spike digest" value={event.neural.spike_sha256.slice(0, 12) + "…"} title={event.neural.spike_sha256} />
              <KeyValue label="Image digest" value={event.neural.input_sha256.slice(0, 12) + "…"} title={event.neural.input_sha256} />
              <KeyValue label="Weight digest" value={event.neural.memory.sha256.slice(0, 12) + "…"} title={event.neural.memory.sha256} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
