import type { TickEvent } from "@/lib/types";
import { isFill, isVeto } from "@/lib/derive";
import { clockTime, decimal, signed } from "@/lib/format";
import { Chip } from "../ui";

/** Newest-first log of observations. One row per neural decision. */
export function EventStream({ events, limit = 26 }: { events: TickEvent[]; limit?: number }) {
  const rows = [...events].slice(-limit).reverse();

  return (
    <section className="panel overflow-hidden">
      <header className="panel-head">
        <h2 className="panel-title">Observation log</h2>
        <span className="text-[0.7rem] text-ink-3">last {rows.length} ticks</span>
      </header>
      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
            <tr className="border-b border-line-soft">
              {["Tick", "Time", "Proposal", "Outcome", "Δ P&L", "Pulse", "Equity"].map((heading) => (
                <th
                  key={heading}
                  className="label px-3 py-2 font-semibold"
                  style={{ textAlign: heading === "Δ P&L" || heading === "Equity" ? "right" : "left" }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((event) => {
              const execution = event.execution;
              const outcome = isFill(execution)
                ? { tone: "emerald" as const, text: execution.status === "FILLED" ? "filled" : "settled" }
                : isVeto(execution)
                  ? { tone: "amber" as const, text: "vetoed" }
                  : { tone: "neutral" as const, text: "hold" };
              return (
                <tr
                  key={event.tick}
                  className="border-b border-line-soft/60 transition-colors last:border-0 hover:bg-raise/60"
                >
                  <td className="num px-3 py-1.5 text-[0.78rem] text-ink-3">#{event.tick}</td>
                  <td className="num px-3 py-1.5 text-[0.78rem] text-ink-3">{clockTime(event.wall_time)}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className="num text-[0.8rem] font-medium"
                      style={{
                        color:
                          event.neural.side === "BUY"
                            ? "var(--color-violet)"
                            : event.neural.side === "SELL"
                              ? "var(--color-rose)"
                              : "var(--color-ink-3)",
                      }}
                    >
                      {event.neural.side}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <Chip tone={outcome.tone} title={isVeto(execution) ? execution.reason : undefined}>
                      {outcome.text}
                    </Chip>
                  </td>
                  <td
                    className="num px-3 py-1.5 text-right text-[0.8rem]"
                    style={{
                      color:
                        Number(event.pnl_delta_usdc) > 0
                          ? "var(--color-emerald)"
                          : Number(event.pnl_delta_usdc) < 0
                            ? "var(--color-rose)"
                            : "var(--color-ink-3)",
                    }}
                  >
                    {signed(event.pnl_delta_usdc, 4)}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        background:
                          event.neural.stimulus === "reward"
                            ? "var(--color-violet)"
                            : event.neural.stimulus === "aversive"
                              ? "var(--color-rose)"
                              : "var(--color-line)",
                      }}
                      title={event.neural.stimulus}
                    />
                  </td>
                  <td className="num px-3 py-1.5 text-right text-[0.8rem] text-ink-2">
                    {decimal(event.equity_usdc, 4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
