import { loadRun } from "@/lib/source";
import { counts, points } from "@/lib/derive";
import { compactNumber } from "@/lib/format";
import { PageHeader, Caveat } from "@/components/PageHeader";
import { Bar, Chip, KeyValue, Panel, Sparkline, Stat } from "@/components/ui";
import { DifferentialChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function NeuralPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run: runName } = await searchParams;
  const data = await loadRun(runName);
  const events = data.events;
  const last = events.at(-1);

  if (!last) {
    return (
      <>
        <PageHeader run={data.run} title="Neural" />
        <Panel>
          <p className="text-[0.85rem] text-ink-3">No observations yet.</p>
        </Panel>
      </>
    );
  }

  const series = points(events);
  const tally = counts(events);
  const memory = last.neural.memory;

  return (
    <>
      <PageHeader
        run={data.run}
        title="Neural"
        subtitle="The readout that becomes a proposal, the reinforcement that moves synapses, and what has actually been verified."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="DNp20 right − left"
          meta={<Chip tone="cyan">decoder input</Chip>}
        >
          <DifferentialChart points={series} threshold={2} height={220} />
          <p className="mt-2 text-[0.72rem] leading-relaxed text-ink-3">
            Shaded band is the ±2 Hz deadband. Everything inside it holds regardless of how active
            the network is. A persistent offset here becomes a persistent one-sided proposal — that
            is circuit bias, not market insight.
          </p>
        </Panel>

        <Panel title="Populations read" meta={<Chip>{last.neural.cell_ids.left.length + last.neural.cell_ids.right.length + last.neural.cell_ids.gate.length} cells</Chip>}>
          <div className="space-y-3">
            <div>
              <div className="label mb-1.5">DNp20 left ({last.neural.cell_ids.left.length})</div>
              <div className="flex flex-wrap gap-1">
                {last.neural.cell_ids.left.map((id) => (
                  <Chip key={id}>{id}</Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="label mb-1.5">DNp20 right ({last.neural.cell_ids.right.length})</div>
              <div className="flex flex-wrap gap-1">
                {last.neural.cell_ids.right.map((id) => (
                  <Chip key={id}>{id}</Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="label mb-1.5">DNpe017 gate ({last.neural.cell_ids.gate.length})</div>
              <div className="flex flex-wrap gap-1">
                {last.neural.cell_ids.gate.map((id) => (
                  <Chip key={id} tone="cyan">
                    {id}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <Panel title="Kenyon cell spikes">
          <Sparkline
            values={series.map((point) => point.kc)}
            width={240}
            height={54}
            tone="var(--color-cyan)"
          />
          <div className="mt-2">
            <KeyValue label="Latest" value={`${last.neural.KC_spikes} spikes`} />
            <KeyValue label="Range" value={`${Math.min(...series.map((p) => p.kc))} – ${Math.max(...series.map((p) => p.kc))}`} />
            <KeyValue label="Whole network" value={compactNumber(last.neural.total_spikes)} />
          </div>
        </Panel>

        <Panel title="Gate spikes">
          <Sparkline
            values={series.map((point) => point.gate)}
            width={240}
            height={54}
            tone="var(--color-blue)"
          />
          <div className="mt-2">
            <KeyValue label="Latest" value={last.neural.gate_spikes} />
            <KeyValue
              label="Ticks with gate"
              value={`${series.filter((point) => point.gate > 0).length} / ${series.length}`}
            />
            <KeyValue label="Effect" value="no gate spike ⇒ hold" />
          </div>
        </Panel>

        <Panel title="Reinforcement">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Reward" value={tally.reward} tone="accent" sub="PAM11 pulses" />
            <Stat label="Aversive" value={tally.aversive} tone="down" sub="PPL101 pulses" align="right" />
          </div>
          <div className="mt-3">
            <Bar value={tally.reward / Math.max(1, tally.ticks)} tone="violet" />
          </div>
          <div className="mt-2 space-y-1">
            <KeyValue label="Latest reward spikes" value={last.neural.reward_spikes} />
            <KeyValue label="Latest aversive spikes" value={last.neural.aversive_spikes} />
            <KeyValue label="Deadband" value="$0.01 per observation" />
          </div>
        </Panel>

        <Panel title="Plasticity" meta={<Chip tone="violet">candidate rule</Chip>}>
          <Sparkline
            values={series.map((point) => point.changed)}
            width={240}
            height={54}
            tone="var(--color-violet)"
          />
          <div className="mt-2">
            <KeyValue label="Edges moved" value={`${memory.changed_edges} / ${compactNumber(memory.plastic_edges)}`} />
            <KeyValue label="Mean efficacy" value={`${memory.mean_efficacy.toFixed(4)}×`} />
            <KeyValue label="Min efficacy" value={`${memory.minimum_efficacy.toFixed(4)}×`} />
            <KeyValue label="Bounds" value="0.10× – 2.00×" />
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Caveat>
          Weight changes are mechanism checks, not evidence of useful credit assignment. Endogenous
          dopamine moves these synapses too, so a change here is not attributable to P&amp;L. The
          fixed decoder stands between any synaptic change and an order — that path is unvalidated.
        </Caveat>
      </div>
    </>
  );
}
