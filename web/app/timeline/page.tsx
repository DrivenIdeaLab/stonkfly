import { loadRun } from "@/lib/source";
import { counts, money, points } from "@/lib/derive";
import { usdc } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Stat } from "@/components/ui";
import { TimelineScrubber } from "@/components/TimelineScrubber";

export const dynamic = "force-dynamic";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run: runName } = await searchParams;
  const data = await loadRun(runName);
  const events = data.events;
  const finance = money(events, data.status?.initial_cash);
  const tally = counts(events);
  const frames = Object.fromEntries(events.map((event) => [event.tick, data.frameUrl(event.tick)]));

  return (
    <>
      <PageHeader
        run={data.run}
        title="Timeline"
        subtitle="Scrub any observation: the frame the network saw, the numbers it produced, and the exact outcome of that decision."
      />

      {events.length === 0 ? (
        <Panel>
          <p className="text-[0.85rem] text-ink-3">No observations to scrub yet.</p>
        </Panel>
      ) : (
        <>
          <Panel className="mb-4" bodyClassName="grid grid-cols-2 gap-4 p-4 md:grid-cols-5">
            <Stat label="Peak equity" value={usdc(finance.peak.toFixed(8), 2)} />
            <Stat label="Max drawdown" value={`−${usdc(finance.drawdown.toFixed(8), 2).slice(1)}`} tone="down" />
            <Stat label="Fees paid" value={usdc(tally.fees.toFixed(8), 4)} sub={`${tally.fills} fills`} />
            <Stat label="Turnover" value={usdc(tally.turnover.toFixed(8), 2)} />
            <Stat label="Refusals" value={tally.vetoes} sub={`${points(events).length} observations`} tone="warn" />
          </Panel>
          <TimelineScrubber events={events} frames={frames} initial={finance.initial} />
        </>
      )}
    </>
  );
}
