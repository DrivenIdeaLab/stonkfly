/**
 * Unit tests for lib/derive.ts — veto tallies, drawdown/stop use, UTC
 * day bucketing, liveness thresholds. Run with `node --test` (Node >= 22.6).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { Execution, TickEvent } from "../lib/types.ts";
import {
  points,
  counts,
  vetoReasons,
  money,
  computeStats,
  attemptsToday,
  secondsSinceLastFill,
  liveness,
  errorState,
} from "../lib/derive.ts";

function makeEvent(overrides: Partial<TickEvent> & { tick: number }): TickEvent {
  return {
    wall_time: 1_700_000_000 + overrides.tick * 60,
    product: "BTC-USDC",
    mode: "paper",
    quote: {
      product: "BTC-USDC",
      bid: "64000",
      ask: "64010",
      timestamp: 1_700_000_000 + overrides.tick * 60,
      base_increment: "0.00000001",
      quote_increment: "0.01",
      price_increment: "0.01",
      minimum_quote: "1",
      minimum_base: "0.00000001",
    },
    equity_usdc: "100.00",
    pnl_delta_usdc: "0",
    neural: {
      side: "HOLD",
      left_hz: 5,
      right_hz: 6,
      difference_hz: 1,
      gate_spikes: 0,
      cell_ids: { left: [], right: [], gate: [] },
      brain_ms: 500,
      compute_seconds: 6.0,
      stimulus: "none",
      stimulus_ms: 200,
      reward_spikes: 0,
      aversive_spikes: 0,
      KC_spikes: 10,
      total_spikes: 70000,
      spike_sha256: "0".repeat(64),
      input_sha256: "1".repeat(64),
      memory: {
        plastic_edges: 7835,
        changed_edges: 0,
        mean_efficacy: 0.9998,
        minimum_efficacy: 0.9812,
        sha256: "2".repeat(64),
        model: "stonkfly-dual-compartment-v1",
      },
    },
    execution: { status: "HOLD" },
    ...overrides,
  } as TickEvent;
}

const VETO_COOLDOWN: Execution = { status: "VETO", reason: "Order cooldown" };
const VETO_SPREAD: Execution = { status: "VETO", reason: "Spread limit" };
const FILLED_BUY: Execution = {
  status: "FILLED",
  mode: "paper",
  base: "0.00015152",
  quote: "9.754",
  fee: "0.0585",
};

test("points maps ticks to chart-ready numbers, money via toChartNumber only", () => {
  const event = makeEvent({ tick: 3, equity_usdc: "99.93679134" });
  const [point] = points([event]);
  assert.equal(point.tick, 3);
  assert.equal(point.equity, 99.93679134);
  assert.equal(point.difference, 1);
  assert.equal(point.stimulus, "none");
});

test("counts tallies stimulus and execution outcomes", () => {
  const events = [
    makeEvent({ tick: 1 }),
    makeEvent({ tick: 2, execution: VETO_COOLDOWN }),
    makeEvent({ tick: 3, execution: VETO_COOLDOWN }),
    makeEvent({ tick: 4, execution: FILLED_BUY }),
  ];
  const tally = counts(events);
  assert.equal(tally.vetoes, 2);
  assert.equal(tally.fills, 1);
});

test("vetoReasons tallies and sorts by count descending", () => {
  const events = [
    makeEvent({ tick: 1, execution: VETO_SPREAD }),
    makeEvent({ tick: 2, execution: VETO_COOLDOWN }),
    makeEvent({ tick: 3, execution: VETO_COOLDOWN }),
    makeEvent({ tick: 4, execution: FILLED_BUY }),
  ];
  const reasons = vetoReasons(events);
  assert.deepEqual(reasons, [
    { reason: "Order cooldown", count: 2 },
    { reason: "Spread limit", count: 1 },
  ]);
});

test("money: drawdown measured from peak, stop use capped at 1", () => {
  // 100 -> 110 -> 95: peak 110, drawdown 15, stop use 15/20 = 0.75
  const events = [
    makeEvent({ tick: 1, equity_usdc: "100" }),
    makeEvent({ tick: 2, equity_usdc: "110" }),
    makeEvent({ tick: 3, equity_usdc: "95" }),
  ];
  const summary = money(events, "100", 20);
  assert.equal(summary.equity, 95);
  assert.equal(summary.peak, 110);
  assert.equal(summary.drawdown, 15);
  assert.equal(summary.stopUse, 0.75);
});

test("money: catastrophic loss caps stopUse at 1, not beyond", () => {
  const events = [
    makeEvent({ tick: 1, equity_usdc: "100" }),
    makeEvent({ tick: 2, equity_usdc: "40" }),
  ];
  const summary = money(events, "100", 20);
  assert.equal(summary.drawdown, 60);
  assert.equal(summary.stopUse, 1);
});

test("money: gains produce zero drawdown", () => {
  const events = [
    makeEvent({ tick: 1, equity_usdc: "100" }),
    makeEvent({ tick: 2, equity_usdc: "105" }),
  ];
  const summary = money(events, "100", 20);
  assert.equal(summary.drawdown, 0);
  assert.equal(summary.stopUse, 0);
  assert.equal(summary.change, 5);
});

test("computeStats averages compute_seconds", () => {
  const events = [
    makeEvent({ tick: 1 }),
    makeEvent({ tick: 2 }),
    makeEvent({ tick: 3 }),
  ];
  events[0].neural.compute_seconds = 3;
  events[1].neural.compute_seconds = 6;
  events[2].neural.compute_seconds = 9;
  assert.deepEqual(computeStats(events), { average: 6, max: 9, total: 18 });
  assert.deepEqual(computeStats([]), { average: 0, max: 0, total: 0 });
});

test("attemptsToday buckets by the UTC day of the newest observation", () => {
  // Newest event: 2023-11-14 23:30 UTC. Older fill: 2023-11-13 (previous UTC day).
  const events = [
    makeEvent({ tick: 1, wall_time: Date.UTC(2023, 10, 13, 12, 0) / 1000, execution: FILLED_BUY }),
    makeEvent({ tick: 2, wall_time: Date.UTC(2023, 10, 14, 23, 30) / 1000, execution: FILLED_BUY }),
    makeEvent({ tick: 3, wall_time: Date.UTC(2023, 10, 14, 23, 59) / 1000 }),
  ];
  // The newest observation is on Nov 14; both Nov-13 fill and Nov-14 fill exist,
  // only the Nov-14 one counts.
  assert.equal(attemptsToday(events), 1);
  // All three on the same UTC day -> both fills count.
  const sameDay = [
    makeEvent({ tick: 1, wall_time: Date.UTC(2023, 10, 14, 0, 1) / 1000, execution: FILLED_BUY }),
    makeEvent({ tick: 2, wall_time: Date.UTC(2023, 10, 14, 12, 0) / 1000, execution: FILLED_BUY }),
    makeEvent({ tick: 3, wall_time: Date.UTC(2023, 10, 14, 23, 59) / 1000 }),
  ];
  assert.equal(attemptsToday(sameDay), 2);
  assert.equal(attemptsToday([]), 0);
});

test("secondsSinceLastFill returns gap and null when no fills", () => {
  const events = [
    makeEvent({ tick: 1, wall_time: 1_000, execution: FILLED_BUY }),
    makeEvent({ tick: 2, wall_time: 1_061 }),
    makeEvent({ tick: 3, wall_time: 1_130 }),
  ];
  assert.equal(secondsSinceLastFill(events), 130);
  assert.equal(secondsSinceLastFill([makeEvent({ tick: 4 })]), null);
});

test("liveness degrades live -> stale -> stopped", () => {
  const now = Date.now() / 1000;
  assert.equal(liveness(now - 30).state, "live");
  assert.equal(liveness(now - 181).state, "stale"); // just past 180s
  assert.equal(liveness(now - 900).state, "stale"); // boundary stays stale
  assert.equal(liveness(now - 901).state, "stopped");
  assert.equal(liveness(null).state, "stopped");
});

test("errorState: no error file means none", () => {
  assert.equal(errorState({ hasError: false, errorAt: null, lastTickAt: 1000 }), "none");
  assert.equal(errorState({ hasError: false, lastTickAt: null }), "none");
});

test("errorState: error newer than last tick is active", () => {
  assert.equal(errorState({ hasError: true, errorAt: 2000, lastTickAt: 1000 }), "error");
  // Equal timestamps: the error accompanied the final observation — active.
  assert.equal(errorState({ hasError: true, errorAt: 1000, lastTickAt: 1000 }), "recovered");
});

test("errorState: stale error.json older than last tick is recovered", () => {
  // The exact paper-run case: ReadTimeout on Sep 14, worker resumed, ticking since.
  assert.equal(errorState({ hasError: true, errorAt: 1000, lastTickAt: 2000 }), "recovered");
});

test("errorState: unknown errorAt (observer < 1.2.1) never hides an incident", () => {
  assert.equal(errorState({ hasError: true, errorAt: null, lastTickAt: 2000 }), "error");
  assert.equal(errorState({ hasError: true, lastTickAt: 2000 }), "error");
  assert.equal(errorState({ hasError: true, errorAt: 2000, lastTickAt: null }), "error");
});
