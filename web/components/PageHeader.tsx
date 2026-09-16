import type { ReactNode } from "react";

import type { RunSummary } from "@/lib/types";
import { ago } from "@/lib/format";
import { errorState } from "@/lib/derive";
import { Chip, IconAlert } from "./ui";
import { Heartbeat } from "./Heartbeat";

export function PageHeader({
  run,
  title,
  subtitle,
  children,
}: {
  run: RunSummary;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <Heartbeat lastTickAt={run.lastTickAt} synthetic={run.synthetic} />
          <Chip tone={run.mode === "live" ? "rose" : "cyan"}>{run.mode.toUpperCase()}</Chip>
          <Chip>{run.name}</Chip>
          {run.synthetic ? <Chip tone="amber">SYNTHETIC</Chip> : null}
          {run.halted ? (
            <Chip tone="amber" title={run.halted}>
              HALTED
            </Chip>
          ) : null}
          {run.hasError
            ? errorState(run) === "error"
              ? (
                  <Chip tone="rose" title="Error is newer than the newest observation">
                    ERROR
                  </Chip>
                )
              : (
                  <Chip tone="amber" title="Recovered: error.json predates the newest observation">
                    RECOVERED
                  </Chip>
                )
            : null}
        </div>
        <h1 className="text-[1.6rem] leading-tight font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-[0.82rem] leading-relaxed text-ink-3">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="label">Last observation</div>
          <div className="num mt-1 text-[0.85rem] text-ink-2">{ago(run.lastTickAt)}</div>
        </div>
        {children}
      </div>
    </header>
  );
}

export function Caveat({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber/20 bg-amber/[0.06] px-3 py-2 text-[0.75rem] leading-relaxed text-amber/90">
      <IconAlert size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
