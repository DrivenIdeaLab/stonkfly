import { loadRun } from "@/lib/source";
import { computeStats, counts, money, points } from "@/lib/derive";
import { base, compactNumber, decimal, percentOrDash, signed, usdc } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { Bar, Chip, KeyValue, Panel, Stat } from "@/components/ui";
import { FlyView } from "@/components/live/FlyView";
import { DecisionMeter } from "@/components/live/DecisionMeter";
import { DopaminePulse } from "@/components/live/DopaminePulse";
import { GuardPanel } from "@/components/live/GuardPanel";
import { GuardChecks } from "@/components/live/GuardChecks";
import { EventStream } from "@/components/live/EventStream";
import { LiveRefresher } from "@/components/live/LiveRefresher";
import { EquityChart } from "@/components/charts";

async function diskFreeRatio(): Promise<number | undefined> {
  const base = process.env.STONKFLY_OBSERVER_URL;
  if (process.env.STONKFLY_SOURCE !== "http" || !base) return undefined;
  try {
    const response = await fetch(`${base}/api/storage`, { cache: "no-store" });
    if (!response.ok) return undefined;
    const data = (await response.json()) as {
      totals: { diskFreeBytes: number; diskTotalBytes: number };
    };
    if (!data.totals || data.totals.diskTotalBytes <= 0) return undefined;
    return data.totals.diskFreeBytes / data.totals.diskTotalBytes;
  } catch {
    return undefined;
  }
}

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const data = await loadRun();
  const events = data.events;
  const last = events.at(-1);

  if (!last) {
    return (
      <>
        <PageHeader run={data.run} title="Live" />
        <Panel>
          <p className="text-[0.85rem] text-ink-3">
            No observations in <span className="num">{data.run.name}</span> yet. Point the console at
            a run directory with <span className="num">STONKFLY_RUNS_DIR</span> or start the worker.
          </p>
        </Panel>
      </>
    );
  }

  const series = points(events);
  const finance = money(events, data.status?.initial_cash);
  const tally = counts(events);
  const compute = computeStats(events);
  const position = data.status?.positions?.[last.product] ?? "0";

  return (
    <>
      <PageHeader
        run={data.run}
        title="Live"
        subtitle="What the network is being shown, what it proposed, and what the guard allowed. Read-only: the console never writes to a run."
      >
        <LiveRefresher seconds={15} run={data.run.name} />
      </PageHeader>

      {/* KPI strip */}
      <Panel className="mb-4" bodyClassName="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Equity"
          value={usdc(last.equity_usdc, 2)}
          sub={`start ${usdc(finance.initial.toFixed(2), 0)}`}
        />
        <Stat
          label="Change"
          value={signed(finance.change.toFixed(8), 2)}
          tone={finance.change > 0 ? "up" : finance.change < 0 ? "down" : "default"}
          sub={percentOrDash(finance.changePct)}
        />
        <Stat
          label="Drawdown"
          value={`−${usdc(finance.drawdown.toFixed(8), 2)}`}
          tone={finance.stopUse > 0.75 ? "warn" : "default"}
          sub={`${percentOrDash(finance.stopUse)} of the $20 stop`}
        />
        <Stat label="Cash" value={usdc(data.status?.cash, 2)} sub={`${base(position, 8)} ${last.product.split("-")[0]}`} />
        <Stat
          label="Observations"
          value={compactNumber(tally.ticks)}
          sub={`${tally.fills} filled · ${tally.vetoes} vetoed`}
        />
        <Stat
          label="Compute / tick"
          value={`${compute.average.toFixed(1)}s`}
          sub={`${compute.max.toFixed(1)}s peak · ${(compute.total / 60).toFixed(1)} min total`}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FlyView event={last} frameUrl={data.frameUrl(last.tick)} />
        </div>
        <div className="space-y-4">
          <DecisionMeter events={events} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <DopaminePulse event={last} />
        <GuardPanel events={events} />

        {/* Operator guard checks — display only, no delivery; thresholds match
            the alert proposal pending Nathan's channel decision */}
        <GuardChecks
          lastTickAt={data.run.lastTickAt}
          halted={data.run.halted}
          drawdownStop={20}
          initialCash={data.status?.initial_cash}
          equity={events.at(-1)?.equity_usdc}
          diskFreeRatio={await diskFreeRatio()}
        />
        <Panel
          title="Plasticity"
          meta={<Chip tone={last.neural.memory.changed_edges > 0 ? "violet" : "neutral"}>candidate rule</Chip>}
        >
          <Stat
            label="Edges moved from baseline"
            value={last.neural.memory.changed_edges}
            sub={`of ${compactNumber(last.neural.memory.plastic_edges)} eligible KC→MBON edges`}
            tone="accent"
          />
          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="label">Mean efficacy</span>
                <span className="num text-[0.78rem] text-ink-2">
                  {last.neural.memory.mean_efficacy.toFixed(4)}×
                </span>
              </div>
              <Bar value={(last.neural.memory.mean_efficacy - 0.1) / 1.9} tone="violet" />
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="label">Minimum efficacy</span>
                <span className="num text-[0.78rem] text-ink-2">
                  {last.neural.memory.minimum_efficacy.toFixed(4)}×
                </span>
              </div>
              <Bar value={(last.neural.memory.minimum_efficacy - 0.1) / 1.9} tone="violet" />
            </div>
          </div>
          <div className="mt-3 border-t border-line-soft pt-2">
            <KeyValue label="Bounds" value="0.10× – 2.00× baseline" />
            <KeyValue label="Rule" value="anti-Hebbian, dopamine-gated" />
            <KeyValue
              label="Verified"
              value={<span className="text-amber">not validated</span>}
              title="Weight changes are mechanism checks, not evidence of useful credit assignment."
            />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Equity" meta={<Chip>mark-to-bid</Chip>}>
            <EquityChart points={series} initial={finance.initial} height={220} />
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.68rem] text-ink-3">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-4 rounded-full bg-cyan" /> equity
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-4 rounded-full bg-blue/60" /> bid price (rescaled)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rotate-45 bg-emerald" /> fill
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber" /> veto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-0.5 bg-violet" /> reward
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-0.5 bg-rose" /> aversive
              </span>
            </div>
          </Panel>
        </div>
        <div className="lg:col-span-1">
          <EventStream events={events} limit={14} />
        </div>
      </div>

      <div className="mt-4">
        <details className="panel p-4" open={events.length < 3 /* first visit heuristic: show until there is history */}>
          <summary className="cursor-pointer select-none text-[0.82rem] font-medium text-ink">
            What am I looking at?
          </summary>
          <div className="mt-3 space-y-2 text-[0.78rem] leading-relaxed text-ink-2">
            <p>
              <span className="text-cyan">Network input</span> — the exact 320×180 chart image
              fed to the retina at the newest observation. What the network sees, not a
              prettified rendering: 3,335 luminance + 811 colour samples per tick.
            </p>
            <p>
              <span className="text-cyan">Decoder meter</span> — mean right-minus-left DNp20
              firing. Past ±2 Hz with a DNpe017 gate spike the fixed readout proposes BUY or
              SELL; inside the shaded deadband it holds. This interface is{" "}
              <em>engineered, not discovered</em>.
            </p>
            <p>
              <span className="text-violet">Reinforcement</span> — equity moves beyond ±$0.01
              drive 200 ms pulses into PAM11 (reward, violet) or PPL101 (aversive, rose)
              dopamine cells. This is an engineered training signal, not pleasure or pain:
              pain receptors are not modeled.
            </p>
            <p>
              <span className="text-amber">Guard</span> — the risk guard can veto a proposal
              (cooldown, spread, limits, stale quote…). It never substitutes a different
              order; a refusal ends the tick.
            </p>
            <p>
              <span className="text-emerald">Fills</span> — paper fills at bid/ask +0.6% per
              side. No live orders exist in this system.{" "}
              <span className="text-ink-3">
                No profitable learning has been demonstrated; this is a mechanism check.
              </span>
            </p>
          </div>
        </details>
      </div>

      <div className="mt-4">
        <EventStream events={events} limit={40} />
      </div>
    </>
  );
}
