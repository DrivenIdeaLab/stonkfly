import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import type { Provenance, RunData, RunError, RunStatus, RunSummary, TickEvent } from "./types";

import fixtureEvents from "./fixture-events.json";
import fixtureProvenance from "./fixture-provenance.json";
import fixtureStatus from "./fixture-status.json";

/**
 * The console is a READ-ONLY observer. Nothing in this file writes to a run
 * directory: the ledger, checkpoints and events are experiment evidence, and a
 * stray write could invalidate provenance or fight the worker's lock.
 *
 * Three sources, chosen by STONKFLY_SOURCE:
 *   fixture — bundled synthetic run, for development (this repo)
 *   file    — read runs/ directly; use when the console shares the container
 *   http    — talk to the stonkfly-observer API; the recommended deployment
 */

export type SourceKind = "fixture" | "file" | "http";

const MAX_EVENTS = 4_000;

export function sourceKind(): SourceKind {
  const raw = (process.env.STONKFLY_SOURCE ?? "fixture").toLowerCase();
  return raw === "file" || raw === "http" ? raw : "fixture";
}

export function defaultRunName(): string {
  return process.env.STONKFLY_RUN ?? "paper";
}

function runsDir(): string {
  return process.env.STONKFLY_RUNS_DIR ?? "/var/lib/stonkfly/runs";
}

function observerUrl(): string {
  return (process.env.STONKFLY_OBSERVER_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
}

async function readJsonIfExists<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** Parse a JSONL file, keeping the newest complete lines. */
async function readEvents(file: string, limit = MAX_EVENTS): Promise<TickEvent[]> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return [];
  }
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  const kept = lines.slice(-limit);
  const events: TickEvent[] = [];
  for (const line of kept) {
    try {
      events.push(JSON.parse(line) as TickEvent);
    } catch {
      // A torn final line is expected while the worker is mid-fsync; skip it.
    }
  }
  return events;
}

function summarise(name: string, events: TickEvent[], halted: string | null, hasError: boolean, synthetic: boolean, path_?: string, errorAt: number | null = null): RunSummary {
  const last = events.at(-1);
  return {
    name,
    mode: last?.mode ?? (halted !== null ? "paper" : "unknown"),
    ticks: last?.tick ?? events.length,
    lastTickAt: last?.wall_time ?? null,
    halted,
    hasError,
    errorAt,
    synthetic,
    path: path_,
  };
}

/**
 * Fixture timestamps are stored at a fixed epoch so the JSON is stable in git,
 * then shifted here so the newest observation lands "now". Without this the
 * console would read months stale and show a stopped worker on a data set that
 * is simply static. The data stays labelled synthetic everywhere it appears.
 */
function shiftToNow(events: TickEvent[]): TickEvent[] {
  const last = events.at(-1);
  if (!last) return events;
  const offset = Date.now() / 1000 - last.wall_time;
  return events.map((event) => ({
    ...event,
    wall_time: event.wall_time + offset,
    quote: { ...event.quote, timestamp: event.quote.timestamp + offset },
  }));
}

async function loadFixture(name: string): Promise<RunData> {
  const events = shiftToNow(fixtureEvents as unknown as TickEvent[]);
  const status = fixtureStatus as unknown as RunStatus;
  return {
    run: summarise(name, events, status.halted, false, true),
    status,
    events,
    provenance: fixtureProvenance as unknown as Provenance,
    error: null,
    frameUrl: (tick) => `/frames/tick-${String(tick).padStart(4, "0")}.png`,
  };
}

async function loadFile(name: string): Promise<RunData> {
  const dir = path.join(runsDir(), name);
  const events = await readEvents(path.join(dir, "events.jsonl"));
  const status =
    (await readJsonIfExists<RunStatus>(path.join(dir, "status.json"))) ??
    // status.json is written by the observer; fall back to deriving from events.
    (events.at(-1)
      ? {
          mode: events.at(-1)!.mode,
          tick: events.at(-1)!.tick,
          cash: "—",
          positions: {},
          initial_cash: "—",
          anchor: "—",
          halted: null,
        }
      : null);
  const provenance = await readJsonIfExists<Provenance>(path.join(dir, "provenance.json"));
  const error = await readJsonIfExists<RunError>(path.join(dir, "error.json"));
  // File-mode parity with observer 1.2.1: errorAt lets the UI distinguish a
  // stale error.json (worker recovered) from an error newer than the last tick.
  const errorPath = path.join(dir, "error.json");
  let errorAt: number | null = null;
  try {
    errorAt = (await fs.stat(errorPath)).mtimeMs / 1000;
  } catch {
    errorAt = null;
  }
  const stopped = await exists(path.join(dir, "STOP"));
  const halted = status?.halted ?? (stopped ? "STOP file present" : null);
  return {
    run: summarise(name, events, halted, error !== null, false, dir, errorAt),
    status: status ? { ...status, halted } : null,
    events,
    provenance,
    error,
    // The app retains only latest-input.png; historical frames need archiving.
    frameUrl: (tick) => {
      const last = events.at(-1);
      return last && tick === last.tick ? `/api/frame?run=${encodeURIComponent(name)}` : null;
    },
  };
}

async function loadHttp(name: string): Promise<RunData> {
  const base = observerUrl();
  const [meta, events, status, provenance, error] = await Promise.all([
    fetchJson<RunSummary>(`${base}/api/runs/${encodeURIComponent(name)}`),
    fetchJson<TickEvent[]>(`${base}/api/runs/${encodeURIComponent(name)}/events`),
    fetchJson<RunStatus>(`${base}/api/runs/${encodeURIComponent(name)}/status`),
    fetchJson<Provenance>(`${base}/api/runs/${encodeURIComponent(name)}/provenance`),
    fetchJson<RunError>(`${base}/api/runs/${encodeURIComponent(name)}/error`),
  ]);
  const eventsSafe = events ?? [];
  return {
    // HTTP mode: the observer (1.2.1+) already reports errorAt in meta; when
    // meta is unavailable the summary falls back to hasError-only semantics.
    run: (meta?.errorAt === undefined && meta?.hasError)
      ? { ...meta, errorAt: null }
      : meta ?? summarise(name, eventsSafe, status?.halted ?? null, error !== null, false),
    status: status ?? null,
    events: eventsSafe,
    provenance: provenance ?? null,
    error: error ?? null,
    // Console-origin proxy to the observer (app/api/frame). Never the
    // observer's LAN URL: that is mixed content behind the HTTPS front door.
    frameUrl: (tick) =>
      `/api/frame?run=${encodeURIComponent(name)}&tick=${tick}`,
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function loadRun(name = defaultRunName()): Promise<RunData> {
  switch (sourceKind()) {
    case "file":
      return loadFile(name);
    case "http":
      return loadHttp(name);
    default:
      return loadFixture(name);
  }
}

export async function listRuns(): Promise<RunSummary[]> {
  if (sourceKind() === "file") {
    try {
      const entries = await fs.readdir(runsDir(), { withFileTypes: true });
      const runs = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const data = await loadFile(entry.name);
            return data.run;
          }),
      );
      return runs.sort((a, b) => (b.lastTickAt ?? 0) - (a.lastTickAt ?? 0));
    } catch {
      return [];
    }
  }
  if (sourceKind() === "http") {
    return (await fetchJson<RunSummary[]>(`${observerUrl()}/api/runs`)) ?? [];
  }
  const data = await loadFixture(defaultRunName());
  return [data.run, { ...data.run, name: "check-fixture", ticks: 6, synthetic: true }];
}
