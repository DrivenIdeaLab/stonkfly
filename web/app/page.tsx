import { loadRun } from "@/lib/source";
import { computeStats, counts, money, points } from "@/lib/derive";
import { base, compactNumber, decimal, percentOrDash, signed, usdc } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { Bar, Chip, KeyValue, Panel, Stat } from "@/components/ui";
import { FlyView } from "@/components/live/FlyView";
import { DecisionMeter } from "@/components/live/DecisionMeter";
import { DopaminePulse } from "@/components/live/DopaminePulse";
import { GuardPanel } from "@/components/live/GuardPanel";
import { EventStream } from "@/components/live/EventStream";
import { LiveRefresher } from "@/components/live/LiveRefresher";
import { EquityChart } from "@/components/charts";

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
        <LiveRefresher seconds={15} />
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
        <EventStream events={events} limit={40} />
      </div>
    </>
  );
}
