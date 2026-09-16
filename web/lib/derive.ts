import type { Execution, Side, Stimulus, TickEvent } from "./types";
import { toChartNumber } from "./format.ts";

export interface Point {
  tick: number;
  t: number;
  equity: number;
  delta: number;
  price: number;
  difference: number;
  gate: number;
  kc: number;
  changed: number;
  meanEfficacy: number;
  stimulus: Stimulus;
  side: Side;
  execution: Execution;
}

export function points(events: TickEvent[]): Point[] {
  return events.map((event) => ({
    tick: event.tick,
    t: event.wall_time,
    equity: toChartNumber(event.equity_usdc),
    delta: toChartNumber(event.pnl_delta_usdc),
    price: toChartNumber(event.quote.bid),
    difference: event.neural.difference_hz,
    gate: event.neural.gate_spikes,
    kc: event.neural.KC_spikes,
    changed: event.neural.memory.changed_edges,
    meanEfficacy: event.neural.memory.mean_efficacy,
    stimulus: event.neural.stimulus,
    side: event.neural.side,
    execution: event.execution,
  }));
}

export type FillExecution = Extract<Execution, { status: "FILLED" | "SETTLED" }>;
export type VetoExecution = Extract<Execution, { status: "VETO" }>;

export function isFill(execution: Execution): execution is FillExecution {
  return execution.status === "FILLED" || execution.status === "SETTLED";
}

export function isVeto(execution: Execution): execution is VetoExecution {
  return execution.status === "VETO";
}

export interface Countdowns {
  ticks: number;
  fills: number;
  vetoes: number;
  holds: number;
  reward: number;
  aversive: number;
  none: number;
  fees: number;
  turnover: number;
}

export function counts(events: TickEvent[]): Countdowns {
  const result: Countdowns = {
    ticks: events.length,
    fills: 0,
    vetoes: 0,
    holds: 0,
    reward: 0,
    aversive: 0,
    none: 0,
    fees: 0,
    turnover: 0,
  };
  for (const event of events) {
    if (isFill(event.execution)) {
      result.fills += 1;
      if (event.execution.status === "FILLED") {
        result.fees += toChartNumber(event.execution.fee);
        result.turnover += toChartNumber(event.execution.quote);
      }
    } else if (isVeto(event.execution)) {
      result.vetoes += 1;
    } else {
      result.holds += 1;
    }
    if (event.neural.stimulus === "reward") result.reward += 1;
    else if (event.neural.stimulus === "aversive") result.aversive += 1;
    else result.none += 1;
  }
  return result;
}

export function vetoReasons(events: TickEvent[]): { reason: string; count: number }[] {
  const tally = new Map<string, number>();
  for (const event of events) {
    if (event.execution.status === "VETO") {
      tally.set(event.execution.reason, (tally.get(event.execution.reason) ?? 0) + 1);
    }
  }
  return [...tally.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

export interface MoneySummary {
  equity: number;
  initial: number;
  change: number;
  changePct: number;
  peak: number;
  drawdown: number;
  /** 0..1 distance travelled toward the loss stop. */
  stopUse: number;
}

export function money(events: TickEvent[], initialCash: string | undefined, lossStop = 20): MoneySummary {
  const series = points(events);
  const equity = series.at(-1)?.equity ?? 0;
  const initial = toChartNumber(initialCash) || series[0]?.equity || 100;
  const peak = series.reduce((max, point) => Math.max(max, point.equity), initial);
  const drawdown = Math.max(0, peak - equity);
  return {
    equity,
    initial,
    change: equity - initial,
    changePct: initial ? (equity - initial) / initial : 0,
    peak,
    drawdown,
    stopUse: Math.min(1, drawdown / lossStop),
  };
}

export function computeStats(events: TickEvent[]): { average: number; max: number; total: number } {
  if (!events.length) return { average: 0, max: 0, total: 0 };
  const values = events.map((event) => event.neural.compute_seconds);
  const total = values.reduce((sum, value) => sum + value, 0);
  return { average: total / values.length, max: Math.max(...values), total };
}

/** Order attempts (fills) inside the UTC day of the newest observation. */
export function attemptsToday(events: TickEvent[]): number {
  const last = events.at(-1);
  if (!last) return 0;
  const day = new Date(last.wall_time * 1000).toISOString().slice(0, 10);
  return events.filter(
    (event) => isFill(event.execution) && new Date(event.wall_time * 1000).toISOString().slice(0, 10) === day,
  ).length;
}

export function secondsSinceLastFill(events: TickEvent[]): number | null {
  const last = events.at(-1);
  const fill = [...events].reverse().find((event) => isFill(event.execution));
  if (!last || !fill) return null;
  return Math.max(0, last.wall_time - fill.wall_time);
}

export function liveness(lastTickAt: number | null): { state: "live" | "stale" | "stopped"; seconds: number } {
  if (lastTickAt === null) return { state: "stopped", seconds: Number.POSITIVE_INFINITY };
  const seconds = Math.max(0, Date.now() / 1000 - lastTickAt);
  // One observation per 60 s minimum, plus generous compute headroom.
  return { state: seconds <= 180 ? "live" : seconds <= 900 ? "stale" : "stopped", seconds };
}

/**
 * Error-state triage for a run summary. An error.json that predates the run's
 * newest observation is evidence of a transient error the worker already
 * recovered from (systemd restarted it and it resumed ticking) — surfaced as
 * "recovered", not "error". Unknown errorAt (observer < 1.2.1) is treated as
 * active so we never hide a real incident behind missing metadata.
 */
export function errorState(run: {
  hasError: boolean;
  errorAt?: number | null;
  lastTickAt: number | null;
}): "none" | "error" | "recovered" {
  if (!run.hasError) return "none";
  const errorAt = run.errorAt ?? null;
  if (errorAt === null) return "error";
  const lastTickAt = run.lastTickAt ?? null;
  if (lastTickAt === null) return "error";
  return errorAt > lastTickAt ? "error" : "recovered";
}
