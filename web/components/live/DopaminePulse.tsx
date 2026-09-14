import type { TickEvent } from "@/lib/types";
import { Chip, KeyValue } from "../ui";

/**
 * Reinforcement is an engineered input to identified cells, not evidence the
 * latest action caused the P&L change. The panel says so, because the pulse
 * light is the most tempting thing in the UI to misread.
 */
export function DopaminePulse({ event }: { event: TickEvent }) {
  const { neural } = event;
  const reward = neural.stimulus === "reward";
  const aversive = neural.stimulus === "aversive";

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Reinforcement</h2>
        <Chip tone={reward ? "violet" : aversive ? "rose" : "neutral"}>
          {reward ? "reward pulse" : aversive ? "aversive pulse" : "within deadband"}
        </Chip>
      </header>

      <div className="space-y-3 p-4">
        <PulseRow
          name="PAM11 (α1)"
          detail="15 cells"
          spikes={neural.reward_spikes}
          active={reward}
          colour="var(--color-violet)"
          meaning="equity rose ≥ $0.01 since the last observation"
        />
        <PulseRow
          name="PPL101 (γ1pedc)"
          detail="2 cells"
          spikes={neural.aversive_spikes}
          active={aversive}
          colour="var(--color-rose)"
          meaning="equity fell ≥ $0.01 since the last observation"
        />

        {neural.stimulus !== "none" ? (
          <div className="rounded-lg border border-line-soft bg-void/50 px-3 py-2">
            <div className="label mb-1">Delivered</div>
            <div className="num text-[0.8rem] text-ink-2">
              {neural.stimulus_ms} ms · 20 mV-equivalent current
            </div>
          </div>
        ) : null}

        <div className="border-t border-line-soft pt-2">
          <KeyValue label="Kenyon cells" value={`${neural.KC_spikes} spikes`} />
          <KeyValue label="Whole network" value={`${neural.total_spikes.toLocaleString("en-US")} spikes`} />
          <KeyValue
            label="Integrate"
            value={`${neural.compute_seconds.toFixed(2)} s wall`}
            title="Wall time for this observation's 500 ms of neural integration"
          />
        </div>
      </div>
    </section>
  );
}

function PulseRow({
  name,
  detail,
  spikes,
  active,
  colour,
  meaning,
}: {
  name: string;
  detail: string;
  spikes: number;
  active: boolean;
  colour: string;
  meaning: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
        {active ? (
          <span
            className="pulse-burst absolute h-6 w-6 rounded-full"
            style={{ background: colour, opacity: 0.35 }}
          />
        ) : null}
        <span
          className="relative h-2.5 w-2.5 rounded-full"
          style={{ background: colour, opacity: active ? 1 : 0.28, boxShadow: active ? `0 0 14px ${colour}` : "none" }}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[0.8rem] text-ink">{name}</span>
          <span className="num text-[0.82rem]" style={{ color: active ? colour : "var(--color-ink-2)" }}>
            {spikes}
          </span>
        </div>
        <div className="truncate text-[0.68rem] text-ink-3">
          {detail} · {meaning}
        </div>
      </div>
    </div>
  );
}
