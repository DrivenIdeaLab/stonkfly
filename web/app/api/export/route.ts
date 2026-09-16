import { loadRun } from "@/lib/source";

export const dynamic = "force-dynamic";

/**
 * Export for bug reports and offline analysis. Read-only.
 *   /api/export?run=paper            -> CSV of observations
 *   /api/export?run=paper&tick=499   -> one raw events.jsonl line (JSON)
 * Money stays a string in both formats.
 */

const CSV_COLUMNS = [
  "tick",
  "wall_time",
  "product",
  "mode",
  "bid",
  "ask",
  "equity_usdc",
  "pnl_delta_usdc",
  "side",
  "left_hz",
  "right_hz",
  "difference_hz",
  "gate_spikes",
  "stimulus",
  "reward_spikes",
  "aversive_spikes",
  "KC_spikes",
  "total_spikes",
  "execution_status",
  "execution_reason",
  "execution_base",
  "execution_quote",
  "execution_fee",
  "spike_sha256",
  "input_sha256",
  "memory_sha256",
] as const;

function csvEscape(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const run = params.get("run") ?? "paper";
  const tickParam = params.get("tick");

  const data = await loadRun(run);
  if (data.events.length === 0) {
    return new Response(JSON.stringify({ error: "no observations" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (tickParam !== null) {
    const tick = Number(tickParam);
    const event = Number.isInteger(tick)
      ? data.events.find((e) => e.tick === tick)
      : undefined;
    if (!event) {
      return new Response(
        JSON.stringify({ error: `tick ${tickParam} not found in retained window` }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify(event, null, 2) + "\n", {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="stonkfly-${run}-tick-${tick}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const rows = data.events.map((e) =>
    [
      e.tick,
      e.wall_time,
      e.product,
      e.mode,
      e.quote.bid,
      e.quote.ask,
      e.equity_usdc,
      e.pnl_delta_usdc,
      e.neural.side,
      e.neural.left_hz,
      e.neural.right_hz,
      e.neural.difference_hz,
      e.neural.gate_spikes,
      e.neural.stimulus,
      e.neural.reward_spikes,
      e.neural.aversive_spikes,
      e.neural.KC_spikes,
      e.neural.total_spikes,
      e.execution.status,
      e.execution.status === "VETO" ? e.execution.reason : "",
      e.execution.status === "FILLED" ? e.execution.base : "",
      e.execution.status === "FILLED" ? e.execution.quote ?? "" : "",
      e.execution.status === "FILLED" ? e.execution.fee ?? "" : "",
      e.neural.spike_sha256,
      e.neural.input_sha256,
      e.neural.memory.sha256,
    ]
      .map(csvEscape)
      .join(","),
  );

  const csv = [CSV_COLUMNS.join(","), ...rows].join("\n") + "\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stonkfly-${run}-observations.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
