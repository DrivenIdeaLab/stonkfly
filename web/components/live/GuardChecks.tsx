import { Chip, KeyValue, Panel } from "@/components/ui";
import { ago } from "@/lib/format";
import { toChartNumber } from "@/lib/format";

/**
 * Operator guard checks — the alert rules you asked for (Phase 4 item 3),
 * rendered as readouts instead of notifications. Delivery is deliberately
 * absent: the destination is Nathan's call. Every threshold here matches the
 * proposal in the Phase 4 gate report.
 *
 *   silent    — newest observation older than 15 min
 *   halted    — the ledger carries a halt reason
 *   disk      — CT106 filesystem under 15% free (served via /api/storage)
 *   drawdown  — equity past 75% of the $20 loss stop ($15+ under initial)
 */
export function GuardChecks({
  lastTickAt,
  halted,
  drawdownStop,
  initialCash,
  equity,
  diskFreeRatio,
}: {
  lastTickAt: number | null;
  halted: string | null;
  drawdownStop: number;
  initialCash?: string;
  equity?: string;
  diskFreeRatio?: number;
}) {
  const silent =
    lastTickAt === null || Date.now() / 1000 - lastTickAt > 15 * 60;
  const drawdown =
    initialCash !== undefined && equity !== undefined
      ? toChartNumber(initialCash) - toChartNumber(equity)
      : null;
  const drawdownBreached = drawdown !== null && drawdown >= drawdownStop * 0.75;
  const diskLow = diskFreeRatio !== undefined && diskFreeRatio < 0.15;

  const checks: { label: string; ok: boolean; detail: string }[] = [
    {
      label: "Worker silent > 15 min",
      ok: !silent,
      detail: lastTickAt ? `newest observation ${ago(lastTickAt)}` : "no observations",
    },
    {
      label: "Halt reason set",
      ok: halted === null,
      detail: halted ?? "none",
    },
    {
      label: "Disk under 15% free",
      ok: diskFreeRatio === undefined ? true : !diskLow,
      detail:
        diskFreeRatio === undefined
          ? "unknown (observer /api/storage unavailable)"
          : `${(diskFreeRatio * 100).toFixed(1)}% free`,
    },
    {
      label: `Drawdown past 75% of the $${drawdownStop} stop`,
      ok: !drawdownBreached,
      detail:
        drawdown === null
          ? "unknown (no initial_cash)"
          : `$${drawdown.toFixed(2)} under start (${((drawdown / drawdownStop) * 100).toFixed(0)}% of stop)`,
    },
  ];

  const failures = checks.filter((check) => !check.ok).length;

  return (
    <Panel
      title="Guard checks"
      meta={
        failures > 0 ? (
          <Chip tone="rose">{failures} breach{failures === 1 ? "" : "es"}</Chip>
        ) : (
          <Chip tone="emerald">all clear</Chip>
        )
      }
    >
      <div className="space-y-2">
        {checks.map((check) => (
          <KeyValue
            key={check.label}
            label={check.label}
            value={
              <span className={check.ok ? "text-emerald" : "text-rose"}>
                {check.ok ? "OK" : "TRIPPED"} · {check.detail}
              </span>
            }
          />
        ))}
      </div>
      <p className="mt-3 text-[0.68rem] leading-snug text-ink-3">
        Display-only. When these trip, nothing is sent anywhere — the delivery
        channel (Telegram via the ops profile, cron watchdog, or email) is an
        open decision recorded in the Phase 4 gate.
      </p>
    </Panel>
  );
}
