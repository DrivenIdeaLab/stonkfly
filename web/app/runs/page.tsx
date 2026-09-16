import { listRuns } from "@/lib/source";
import { PageHeader } from "@/components/PageHeader";
import { Chip, Panel, Stat } from "@/components/ui";

/**
 * Run registry: every run directory the source can see, with mode, tick count,
 * freshness and health. Purely a switcher — selecting a run changes which run
 * the read-only console displays (a view state, never a worker action).
 */
export const dynamic = "force-dynamic";

function lastSeen(lastTickAt: number | null): string {
  if (!lastTickAt) return "never";
  const seconds = Math.max(0, Math.round(Date.now() / 1000 - lastTickAt));
  if (seconds < 90) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function modeChip(mode: string) {
  if (mode === "live") return <Chip tone="rose">LIVE</Chip>;
  if (mode === "paper") return <Chip tone="blue">PAPER</Chip>;
  return <Chip>UNKNOWN</Chip>;
}

export default async function RunsPage() {
  const runs = await listRuns();

  const totalTicks = runs.reduce((sum, run) => sum + run.ticks, 0);
  const haltedCount = runs.filter((run) => run.halted).length;
  const errorCount = runs.filter((run) => run.hasError).length;
  const activeCount = runs.filter(
    (run) =>
      !run.halted &&
      !run.hasError &&
      run.lastTickAt !== null &&
      Date.now() / 1000 - run.lastTickAt < 15 * 60,
  ).length;

  return (
    <>
      <PageHeader
        run={runs[0] ?? { name: "—", mode: "unknown", ticks: 0, lastTickAt: null, halted: null, hasError: false, synthetic: false }}
        title="Runs"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Runs" value={runs.length} sub={`${totalTicks.toLocaleString("en-US")} observations total`} />
        <Stat
          label="Fresh"
          value={activeCount}
          sub="newest observation < 15 min old"
          tone={activeCount > 0 ? "up" : "warn"}
        />
        <Stat label="Halted" value={haltedCount} sub="halt reason set in ledger" tone={haltedCount > 0 ? "down" : "default"} />
        <Stat label="With errors" value={errorCount} sub="error.json present" tone={errorCount > 0 ? "warn" : "default"} />
      </div>

      <Panel
        title="Run registry"
        meta={<span className="text-[0.72rem] text-ink-3">newest first · click to view</span>}
      >
        {runs.length === 0 ? (
          <p className="text-sm text-ink-3">
            No runs found. The console is a read-only observer; runs appear here when the
            worker writes them under the runs root.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.72rem] text-ink-3">
                  <th className="py-2 pr-4 font-normal">Run</th>
                  <th className="py-2 pr-4 font-normal">Mode</th>
                  <th className="py-2 pr-4 font-normal text-right">Observations</th>
                  <th className="py-2 pr-4 font-normal text-right">Last tick</th>
                  <th className="py-2 pr-4 font-normal">State</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const stale =
                    run.lastTickAt !== null && Date.now() / 1000 - run.lastTickAt > 15 * 60;
                  return (
                    <tr key={run.name} className="border-b border-line/50 last:border-0">
                      <td className="py-2.5 pr-4">
                        <a
                          className="text-ink hover:text-cyan underline-offset-4 hover:underline"
                          href={`/?run=${encodeURIComponent(run.name)}`}
                        >
                          {run.name}
                        </a>
                        {run.synthetic ? (
                          <span className="ml-2 align-middle">
                            <Chip tone="amber">SYNTHETIC</Chip>
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-4">{modeChip(run.mode)}</td>
                      <td className="num py-2.5 pr-4 text-right text-ink-2">
                        {run.ticks.toLocaleString("en-US")}
                      </td>
                      <td className="num py-2.5 pr-4 text-right text-ink-2">
                        {lastSeen(run.lastTickAt)}
                      </td>
                      <td className="py-2.5 pr-4">
                        {run.halted ? (
                          <Chip tone="rose" title={run.halted}>
                            HALTED
                          </Chip>
                        ) : run.hasError ? (
                          <Chip tone="amber">ERROR</Chip>
                        ) : stale ? (
                          <Chip tone="amber">STALE</Chip>
                        ) : (
                          <Chip tone="emerald">RUNNING</Chip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-[0.72rem] text-ink-3">
        State is derived from run artifacts only (events, status, error.json). A run shows
        RUNNING when its newest observation is under 15 minutes old and no halt or error is
        recorded — it is a statement about data freshness, not about the worker process.
      </p>
    </>
  );
}
