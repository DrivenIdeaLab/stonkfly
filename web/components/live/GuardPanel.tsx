import type { TickEvent } from "@/lib/types";
import { attemptsToday, isFill, isVeto, secondsSinceLastFill, vetoReasons } from "@/lib/derive";
import { base, shortReason, usdc } from "@/lib/format";
import { Bar, Chip, KeyValue } from "../ui";

/**
 * The guard can refuse a proposal. It can never replace one — there is no
 * fallback trade and no smarter order behind it. Showing refusals prominently
 * is the point: veto reasons are the most informative signal in the system.
 */
export function GuardPanel({ events, dailyLimit = 24, cooldown = 60 }: { events: TickEvent[]; dailyLimit?: number; cooldown?: number }) {
  const event = events.at(-1)!;
  const execution = event.execution;
  const attempts = attemptsToday(events);
  const sinceFill = secondsSinceLastFill(events);
  const cooldownUse = sinceFill === null ? 1 : Math.min(1, sinceFill / cooldown);
  const tally = vetoReasons(events).slice(0, 5);

  const statusTone =
    isFill(execution) ? "emerald" : isVeto(execution) ? "amber" : "neutral";
  const statusLabel =
    execution.status === "HOLD"
      ? "no order"
      : isVeto(execution)
        ? "vetoed"
        : execution.status.toLowerCase();

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Guard &amp; execution</h2>
        <Chip tone={statusTone}>{statusLabel}</Chip>
      </header>

      <div className="space-y-4 p-4">
        {/* proposal -> outcome */}
        <div className="flex items-center gap-3 rounded-lg border border-line-soft bg-void/50 p-3">
          <div className="min-w-0 flex-1">
            <div className="label">Neural proposal</div>
            <div
              className="num mt-1 text-lg font-semibold"
              style={{
                color:
                  event.neural.side === "BUY"
                    ? "var(--color-violet)"
                    : event.neural.side === "SELL"
                      ? "var(--color-rose)"
                      : "var(--color-ink-2)",
              }}
            >
              {event.neural.side}
            </div>
          </div>
          <span className="text-ink-3">→</span>
          <div className="min-w-0 flex-1 text-right">
            <div className="label">Outcome</div>
            <div className="mt-1 truncate text-[0.85rem] text-ink">
              {execution.status === "HOLD" ? (
                <span className="text-ink-3">nothing submitted</span>
              ) : isVeto(execution) ? (
                <span className="text-amber" title={execution.reason}>
                  {shortReason(execution.reason)}
                </span>
              ) : execution.status === "FILLED" ? (
                <span className="text-emerald">
                  filled {base(execution.base)} BTC
                </span>
              ) : (
                execution.status
              )}
            </div>
          </div>
        </div>

        {isVeto(execution) ? (
          <p className="rounded-md border border-amber/20 bg-amber/[0.06] px-2.5 py-1.5 text-[0.72rem] leading-relaxed text-amber/90">
            {execution.reason}. A refusal ends the tick; it never becomes a different order.
          </p>
        ) : null}

        {execution.status === "FILLED" ? (
          <div>
            <KeyValue label="Notional" value={usdc(execution.quote, 6)} />
            <KeyValue label="Modelled fee (0.6%)" value={usdc(execution.fee, 6)} />
          </div>
        ) : null}

        {/* budget + rate limits */}
        <div className="space-y-3 border-t border-line-soft pt-3">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="label">Order attempts today</span>
              <span className="num text-[0.78rem] text-ink-2">
                {attempts} / {dailyLimit}
              </span>
            </div>
            <Bar value={attempts / dailyLimit} tone={attempts >= dailyLimit ? "rose" : "cyan"} />
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="label">Cooldown</span>
              <span className="num text-[0.78rem] text-ink-2">
                {sinceFill === null ? "no fills yet" : `${sinceFill.toFixed(0)} s / ${cooldown} s`}
              </span>
            </div>
            <Bar value={cooldownUse} tone={cooldownUse < 1 ? "amber" : "emerald"} />
          </div>
        </div>

        {tally.length ? (
          <div className="border-t border-line-soft pt-3">
            <div className="label mb-2">Why orders were refused</div>
            <div className="flex flex-wrap gap-1.5">
              {tally.map(({ reason, count }) => (
                <Chip key={reason} tone="amber" title={reason}>
                  {shortReason(reason)}
                  <span className="num ml-1 text-amber/70">{count}</span>
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
