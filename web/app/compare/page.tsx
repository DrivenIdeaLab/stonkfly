import Link from "next/link";
import { listRuns, loadRun } from "@/lib/source";
import { PageHeader, Caveat } from "@/components/PageHeader";
import { Chip, Panel, Stat } from "@/components/ui";
import { toChartNumber, usdc, signed } from "@/lib/format";

/**
 * Run comparison: two runs overlaid on one equity chart, indexed by
 * observation number (tick), not wall time — runs start at different moments.
 *
 * The honest framing matters more than the chart: a control run (e.g.
 * --frozen) is the only comparison that isolates what learning changed.
 * Everything else compares two experiments, not learning vs no-learning.
 * Money is converted to numbers ONLY for chart geometry (toChartNumber);
 * displayed balances render straight off the decimal strings.
 */
export const dynamic = "force-dynamic";

type Series = {
  name: string;
  mode: string;
  points: { i: number; equity: string; wall: number }[];
  firstEquity: string | null;
  lastEquity: string | null;
  fills: number;
  vetoes: number;
  frozen: boolean | null;
};

const SERIES_COLORS = ["var(--color-cyan)", "var(--color-violet)"] as const;

async function series(name: string | undefined): Promise<Series | null> {
  if (!name) return null;
  const data = await loadRun(name);
  if (data.events.length === 0) return null;
  const fills = data.events.filter(
    (e) => e.execution.status === "FILLED" || e.execution.status === "SETTLED",
  ).length;
  const vetoes = data.events.filter((e) => e.execution.status === "VETO").length;
  const settings = (data.provenance?.settings ?? {}) as Record<string, unknown>;
  return {
    name,
    mode: data.run.mode,
    points: data.events.map((e, i) => ({
      i,
      equity: e.equity_usdc,
      wall: e.wall_time,
    })),
    firstEquity: data.events[0]?.equity_usdc ?? null,
    lastEquity: data.events.at(-1)?.equity_usdc ?? null,
    fills,
    vetoes,
    frozen: typeof settings.learning === "boolean" ? !settings.learning : null,
  };
}

function CompareChart({ a, b }: { a: Series; b: Series }) {
  const W = 800;
  const height = 300;
  const pad = { top: 18, right: 60, bottom: 28, left: 8 };
  const innerW = W - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const nums = [...a.points, ...b.points].map((p) => toChartNumber(p.equity));
  const hi = Math.max(...nums);
  const lo = Math.min(...nums);
  const maxLen = Math.max(a.points.length, b.points.length);
  const initial = toChartNumber(a.firstEquity ?? "100");

  const x = (i: number) => pad.left + (maxLen <= 1 ? 0 : (i / (maxLen - 1)) * innerW);
  const y = (v: number) =>
    pad.top + innerH - ((v - lo) / (hi - lo || 1)) * innerH;

  const path = (s: Series) =>
    s.points
      .map((p, idx) => `${idx === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(toChartNumber(p.equity)).toFixed(1)}`)
      .join(" ");

  const yInitial =
    initial >= lo && initial <= hi ? (
      <line
        x1={pad.left}
        x2={W - pad.right}
        y1={y(initial)}
        y2={y(initial)}
        stroke="var(--color-ink-3)"
        strokeDasharray="3 4"
        strokeOpacity="0.6"
      />
    ) : null;

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label="Equity comparison">
      {yInitial}
      <path d={path(a)} fill="none" stroke={SERIES_COLORS[0]} strokeWidth="1.8" />
      <path d={path(b)} fill="none" stroke={SERIES_COLORS[1]} strokeWidth="1.8" />
      <text x={pad.left} y={height - 8} fontSize="10" fill="var(--color-ink-3)">obs 1</text>
      <text x={W - pad.right} y={height - 8} fontSize="10" textAnchor="end" fill="var(--color-ink-3)">
        obs {maxLen}
      </text>
      <text x={W - pad.right + 6} y={pad.top + 8} fontSize="10" fill="var(--color-ink-3)">{hi.toFixed(2)}</text>
      <text x={W - pad.right + 6} y={pad.top + innerH} fontSize="10" fill="var(--color-ink-3)">{lo.toFixed(2)}</text>
    </svg>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a: aName, b: bName } = await searchParams;
  const runs = await listRuns();
  const a = await series(aName ?? runs[0]?.name);
  const b = await series(bName ?? runs.find((r) => r.name !== (aName ?? runs[0]?.name))?.name);

  return (
    <>
      <PageHeader
        run={runs[0] ?? { name: "—", mode: "unknown", ticks: 0, lastTickAt: null, halted: null, hasError: false, synthetic: false }}
        title="Compare"
        subtitle="Two runs on one equity chart, indexed by observation number. A --frozen control is the only comparison that isolates learning; anything else compares two experiments."
      />

      {!a || !b ? (
        <Panel title="Not enough runs">
          <p className="text-sm text-ink-3">
            Comparison needs two runs with observations. Available:{" "}
            {runs.map((r) => r.name).join(", ") || "none"}.
          </p>
        </Panel>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {([["a", a, 0], ["b", b, 1]] as const).map(([key, s, idx]) => (
              <form key={key} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: SERIES_COLORS[idx] }}
                />
                <select
                  name={key}
                  defaultValue={s.name}
                  className="rounded-md border border-line bg-panel px-2 py-1 text-[0.8rem] text-ink"
                  aria-label={`Run ${key.toUpperCase()}`}
                >
                  {runs.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="chip cursor-pointer"
                  title={`Overlay ${key.toUpperCase()} with the other series`}
                >
                  set
                </button>
              </form>
            ))}
          </div>

          <Panel title="Equity overlay" meta={<span className="text-[0.72rem] text-ink-3">dashed line = A&apos;s starting equity</span>}>
            <CompareChart a={a} b={b} />
          </Panel>

          <div className="grid gap-4 sm:grid-cols-2">
            {([a, b] as const).map((s, idx) => (
              <Panel
                key={s.name}
                title={s.name}
                meta={
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[idx] }} />
                    {s.frozen === true ? <Chip tone="blue">FROZEN CONTROL</Chip> : s.frozen === false ? <Chip tone="violet">LEARNING</Chip> : null}
                  </span>
                }
              >
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Equity now" value={usdc(s.lastEquity ?? undefined)} />
                  <Stat
                    label="Change"
                    value={s.firstEquity && s.lastEquity ? signed((toChartNumber(s.lastEquity) - toChartNumber(s.firstEquity)).toFixed(8), 2) : "—"}
                    tone={
                      s.firstEquity && s.lastEquity && toChartNumber(s.lastEquity) >= toChartNumber(s.firstEquity)
                        ? "up"
                        : "down"
                    }
                  />
                  <Stat label="Observations" value={s.points.length} />
                  <Stat label="Fills / vetoes" value={`${s.fills} / ${s.vetoes}`} />
                </div>
              </Panel>
            ))}
          </div>

          <Caveat>
            Divergence between a learning run and its frozen control is a mechanism
            readout, not evidence of profitable learning. Runs started at different
            times saw different markets: only the ticks, not the prices, are aligned.
            No profitable learning has been demonstrated by this repository.
          </Caveat>

          <p className="text-[0.72rem] text-ink-3">
            Tip: the runs registry (<Link href="/runs" className="underline-offset-2 hover:underline">Runs</Link>) lists every run;
            the worker&apos;s <span className="num">--frozen</span> flag creates a control run in its own run directory.
          </p>
        </>
      )}
    </>
  );
}
