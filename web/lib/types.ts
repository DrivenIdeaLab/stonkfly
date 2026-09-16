/**
 * Types mirror the on-disk artifacts produced by stonkfly/cli.py exactly.
 *
 * Money is a string on the wire because the app uses Decimal end-to-end. It
 * stays a string here: only chart geometry is allowed to convert it to a
 * number, never a displayed balance.
 */

export type Mode = "paper" | "live";
export type Side = "BUY" | "SELL" | "HOLD";
export type Stimulus = "none" | "reward" | "aversive";

export interface Quote {
  product: string;
  bid: string;
  ask: string;
  timestamp: number;
  base_increment: string;
  quote_increment: string;
  price_increment: string;
  minimum_quote: string;
  minimum_base: string;
}

export interface MemoryBlock {
  plastic_edges: number;
  changed_edges: number;
  mean_efficacy: number;
  minimum_efficacy: number;
  sha256: string;
  model: string;
}

export interface NeuralBlock {
  side: Side;
  left_hz: number;
  right_hz: number;
  difference_hz: number;
  gate_spikes: number;
  cell_ids: { left: string[]; right: string[]; gate: string[] };
  brain_ms: number;
  compute_seconds: number;
  stimulus: Stimulus;
  stimulus_ms: number;
  reward_spikes: number;
  aversive_spikes: number;
  KC_spikes: number;
  total_spikes: number;
  spike_sha256: string;
  input_sha256: string;
  memory: MemoryBlock;
}

export type Execution =
  | { status: "HOLD" }
  | { status: "VETO"; reason: string }
  | { status: "FILLED"; mode: Mode; base: string; quote: string; fee: string }
  | { status: "REJECTED"; mode: Mode }
  | { status: "SETTLED"; mode: Mode; client_order_id: string };

export interface TickEvent {
  tick: number;
  wall_time: number;
  product: string;
  mode: Mode;
  quote: Quote;
  equity_usdc: string;
  pnl_delta_usdc: string;
  neural: NeuralBlock;
  execution: Execution;
}

/** `stonkfly status --out <dir>`: the meta table of ledger.sqlite. */
export interface RunStatus {
  mode: Mode;
  tick: number;
  cash: string;
  positions: Record<string, string>;
  initial_cash: string;
  anchor: string;
  halted: string | null;
}

export interface Provenance {
  settings: Record<string, unknown>;
  dataset: { release: string; neurons: number; directed_edges: number; arrays_verified: boolean };
  vision?: Record<string, unknown>;
  mode: Mode;
  feed: string;
  decoder: string;
  learning_validated: boolean;
  pain_receptors_modeled: boolean;
  timing: string;
  source_sha256: Record<string, string>;
}

export interface RunError {
  type: string;
  reason: string;
  locations: string[];
}

export interface RunSummary {
  name: string;
  mode: Mode | "unknown";
  ticks: number;
  lastTickAt: number | null;
  halted: string | null;
  hasError: boolean;
  errorAt?: number | null;
  /** True when the data is synthetic or does not come from a live worker. */
  synthetic: boolean;
  path?: string;
}

export interface RunData {
  run: RunSummary;
  status: RunStatus | null;
  events: TickEvent[];
  provenance: Provenance | null;
  error: RunError | null;
  /**
   * URL for the exact RGB frame shown to the network at a tick, or null.
   * The app only keeps `latest-input.png`, so historical frames are only
   * available when something archives them (see the observer in the runbook).
   */
  frameUrl: (tick: number) => string | null;
}
