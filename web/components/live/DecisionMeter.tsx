import type { TickEvent } from "@/lib/types";
import { Chip } from "../ui";

const RANGE = 8; // Hz either side of zero

function position(hz: number): number {
  return Math.max(0, Math.min(100, ((hz + RANGE) / (RANGE * 2)) * 100));
}

/**
 * The decoder is the hinge of the whole experiment: mean right DNp20 firing
 * minus mean left, gated by a DNpe017 spike, with a +/-2 Hz deadband. This
 * draws that boundary so a persistent circuit bias is visible as bias — not as
 * a number buried in a table.
 */
export function DecisionMeter({ events }: { events: TickEvent[] }) {
  const event = events.at(-1)!;
  const { neural } = event;
  const diff = neural.difference_hz;
  const threshold = 2;
  const colour =
    neural.side === "BUY"
      ? "var(--color-violet)"
      : neural.side === "SELL"
        ? "var(--color-rose)"
        : "var(--color-ink-3)";

  const history = events.slice(-28).map((e) => e.neural.difference_hz);

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Decoded proposal</h2>
        <Chip tone={neural.side === "BUY" ? "violet" : neural.side === "SELL" ? "rose" : "neutral"}>
          {neural.side}
        </Chip>
      </header>

      <div className="space-y-4 p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="label">DNp20 right − left</div>
            <div className="num mt-1 text-2xl font-semibold" style={{ color: colour }}>
              {diff > 0 ? "+" : ""}
              {diff.toFixed(2)} <span className="text-sm font-normal text-ink-3">Hz</span>
            </div>
          </div>
          <div className="text-right">
            <div className="label">DNpe017 gate</div>
            <div className="num mt-1 text-2xl font-semibold text-ink">
              {neural.gate_spikes}
              <span className="text-sm font-normal text-ink-3"> spikes</span>
            </div>
          </div>
        </div>

        {/* The meter: deadband shaded, thresholds marked, marker at the reading. */}
        <div>
          <div className="relative h-14 overflow-hidden rounded-lg border border-line bg-void/60">
            <div
              className="absolute inset-y-0 border-x border-dashed border-line bg-ink/[0.05]"
              style={{ left: `${position(-threshold)}%`, width: `${((threshold * 2) / (RANGE * 2)) * 100}%` }}
            />
            <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
            {history.map((value, index) => {
              const opacity = 0.12 + (index / history.length) * 0.5;
              return (
                <span
                  key={index}
                  className="absolute bottom-1 h-1.5 w-[2px] rounded-full"
                  style={{
                    left: `${position(value)}%`,
                    background:
                      value >= threshold
                        ? "var(--color-violet)"
                        : value <= -threshold
                          ? "var(--color-rose)"
                          : "var(--color-ink-3)",
                    opacity,
                  }}
                />
              );
            })}
            <div
              className="absolute inset-y-1.5 w-[3px] -translate-x-1/2 rounded-full transition-[left] duration-500"
              style={{ left: `${position(diff)}%`, background: colour, boxShadow: `0 0 16px ${colour}` }}
            />
            <span className="absolute top-1 left-2 text-[0.6rem] tracking-wider text-ink-3">
              ← SELL
            </span>
            <span className="absolute top-1 right-2 text-[0.6rem] tracking-wider text-ink-3">
              BUY →
            </span>
            <span
              className="num absolute bottom-0.5 -translate-x-1/2 text-[0.6rem] text-ink-3"
              style={{ left: `${position(-threshold)}%` }}
            >
              −{threshold}
            </span>
            <span
              className="num absolute bottom-0.5 -translate-x-1/2 text-[0.6rem] text-ink-3"
              style={{ left: `${position(threshold)}%` }}
            >
              +{threshold}
            </span>
          </div>
          <p className="mt-2 text-[0.7rem] leading-relaxed text-ink-3">
            Fixed mapping, engineered not discovered: past ±{threshold} Hz with a DNpe017 spike the
            readout is BUY or SELL; inside the shaded deadband, or without a gate spike, it holds.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-line-soft pt-3">
          <div>
            <div className="label">Left population</div>
            <div className="num mt-1 text-[0.95rem] text-ink-2">
              {neural.left_hz.toFixed(2)} Hz
              <span className="ml-1.5 text-[0.7rem] text-ink-3">
                {neural.cell_ids.left.length} cells
              </span>
            </div>
          </div>
          <div>
            <div className="label">Right population</div>
            <div className="num mt-1 text-[0.95rem] text-ink-2">
              {neural.right_hz.toFixed(2)} Hz
              <span className="ml-1.5 text-[0.7rem] text-ink-3">
                {neural.cell_ids.right.length} cells
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
