import type { Point } from "@/lib/derive";
import { isFill, isVeto } from "@/lib/derive";
import { compactNumber } from "@/lib/format";

const W = 800;

/**
 * Hand-rolled SVG: at one observation per minute there is no need for a chart
 * library, and owning the pixels keeps the instrument look consistent.
 */
export function EquityChart({
  points,
  height = 240,
  initial,
  showPrice = true,
  selected,
}: {
  points: Point[];
  height?: number;
  initial?: number;
  showPrice?: boolean;
  selected?: number;
}) {
  if (points.length < 2) {
    return <div className="flex h-40 items-center justify-center text-[0.8rem] text-ink-3">Not enough observations yet</div>;
  }

  const pad = { top: 16, right: 56, bottom: 26, left: 8 };
  const innerW = W - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const equities = points.map((p) => p.equity);
  const baseline = initial ?? equities[0];
  const lo = Math.min(...equities, baseline) - 0.15;
  const hi = Math.max(...equities, baseline) + 0.15;
  const span = hi - lo || 1;

  const prices = points.map((p) => p.price);
  const pLo = Math.min(...prices);
  const pHi = Math.max(...prices);
  const pSpan = pHi - pLo || 1;

  const x = (index: number) => pad.left + (index / (points.length - 1)) * innerW;
  const y = (value: number) => pad.top + innerH - ((value - lo) / span) * innerH;
  const py = (value: number) => pad.top + innerH - ((value - pLo) / pSpan) * innerH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.equity).toFixed(1)}`).join(" ");
  const priceLine = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${py(p.price).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full">
      <defs>
        <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-cyan)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-cyan)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grid + reference baseline at starting equity */}
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
        <line
          key={fraction}
          x1={pad.left}
          x2={W - pad.right}
          y1={pad.top + fraction * innerH}
          y2={pad.top + fraction * innerH}
          stroke="var(--color-line-soft)"
          strokeDasharray={fraction === 1 || fraction === 0 ? "0" : "3 5"}
        />
      ))}
      <line
        x1={pad.left}
        x2={W - pad.right}
        y1={y(baseline)}
        y2={y(baseline)}
        stroke="var(--color-ink-3)"
        strokeOpacity="0.5"
        strokeDasharray="4 4"
      />
      <text x={W - pad.right + 6} y={y(baseline) + 4} fontSize="10" fill="var(--color-ink-3)">
        start
      </text>

      {showPrice ? (
        <path d={priceLine} fill="none" stroke="var(--color-blue)" strokeOpacity="0.42" strokeWidth="1.25" />
      ) : null}

      <path d={`${line} L${x(points.length - 1)},${pad.top + innerH} L${pad.left},${pad.top + innerH} Z`} fill="url(#equityFill)" />
      <path d={line} fill="none" stroke="var(--color-cyan)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* event markers along the bottom axis */}
      {points.map((point, index) => {
        if (isFill(point.execution)) {
          return (
            <g key={`fill-${point.tick}`}>
              <line x1={x(index)} x2={x(index)} y1={pad.top} y2={pad.top + innerH} stroke="var(--color-emerald)" strokeOpacity="0.28" />
              <rect x={x(index) - 3} y={pad.top + innerH - 3} width="6" height="6" fill="var(--color-emerald)" transform={`rotate(45 ${x(index)} ${pad.top + innerH})`} />
            </g>
          );
        }
        if (isVeto(point.execution)) {
          return (
            <circle key={`veto-${point.tick}`} cx={x(index)} cy={pad.top + innerH - 1} r="1.8" fill="var(--color-amber)" fillOpacity="0.85" />
          );
        }
        return null;
      })}

      {/* dopamine pulses as small ticks under the axis */}
      {points.map((point, index) =>
        point.stimulus === "none" ? null : (
          <line
            key={`pulse-${point.tick}`}
            x1={x(index)}
            x2={x(index)}
            y1={pad.top + innerH + 4}
            y2={pad.top + innerH + 9}
            stroke={point.stimulus === "reward" ? "var(--color-violet)" : "var(--color-rose)"}
            strokeWidth="2"
          />
        ),
      )}

      {selected !== undefined ? (
        <line
          x1={x(selected)}
          x2={x(selected)}
          y1={pad.top}
          y2={pad.top + innerH}
          stroke="var(--color-ink)"
          strokeOpacity="0.5"
        />
      ) : null}

      {/* axis labels */}
      <text x={pad.left} y={height - 8} fontSize="10" fill="var(--color-ink-3)">
        tick #{points[0].tick}
      </text>
      <text x={W - pad.right} y={height - 8} fontSize="10" textAnchor="end" fill="var(--color-ink-3)">
        tick #{points.at(-1)!.tick} · {points.at(-1)!.equity < baseline ? "below" : "above"} start
      </text>
      <text x={W - pad.right + 6} y={pad.top + 8} fontSize="10" fill="var(--color-ink-3)">
        {hi.toFixed(2)}
      </text>
      <text x={W - pad.right + 6} y={pad.top + innerH} fontSize="10" fill="var(--color-ink-3)">
        {lo.toFixed(2)}
      </text>
    </svg>
  );
}

/** DNp20 differential over time, with the decoder's deadband drawn as a band. */
export function DifferentialChart({ points, threshold = 2, height = 200 }: { points: Point[]; threshold?: number; height?: number }) {
  if (points.length < 2) return null;
  const pad = { top: 14, right: 44, bottom: 22, left: 8 };
  const innerW = W - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = points.map((p) => p.difference);
  const extent = Math.max(threshold + 1, ...values.map(Math.abs));
  const x = (index: number) => pad.left + (index / (points.length - 1)) * innerW;
  const y = (value: number) => pad.top + innerH / 2 - (value / extent) * (innerH / 2);

  const line = values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full">
      <rect
        x={pad.left}
        y={y(threshold)}
        width={innerW}
        height={Math.abs(y(-threshold) - y(threshold))}
        fill="var(--color-ink)"
        fillOpacity="0.05"
      />
      {[threshold, 0, -threshold].map((value) => (
        <line
          key={value}
          x1={pad.left}
          x2={W - pad.right}
          y1={y(value)}
          y2={y(value)}
          stroke={value === 0 ? "var(--color-line)" : "var(--color-ink-3)"}
          strokeOpacity={value === 0 ? 1 : 0.35}
          strokeDasharray={value === 0 ? "0" : "4 4"}
        />
      ))}
      {points.map((point, index) =>
        Math.abs(point.difference) >= threshold ? (
          <circle
            key={point.tick}
            cx={x(index)}
            cy={y(point.difference)}
            r="2.4"
            fill={point.difference > 0 ? "var(--color-violet)" : "var(--color-rose)"}
          />
        ) : null,
      )}
      <path d={line} fill="none" stroke="var(--color-cyan)" strokeWidth="1.6" strokeLinejoin="round" />
      <text x={W - pad.right + 6} y={y(threshold) + 4} fontSize="10" fill="var(--color-ink-3)">
        +{threshold}
      </text>
      <text x={W - pad.right + 6} y={y(-threshold) + 4} fontSize="10" fill="var(--color-ink-3)">
        −{threshold}
      </text>
      <text x={pad.left} y={height - 6} fontSize="10" fill="var(--color-ink-3)">
        {compactNumber(points.length)} observations · dots mark crossings that became proposals
      </text>
    </svg>
  );
}
