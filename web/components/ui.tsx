import type { ReactNode } from "react";

/* ---------------------------------------------------------------- primitives */

export function Panel({
  title,
  meta,
  children,
  className = "",
  bodyClassName = "p-4",
}: {
  title?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title ? (
        <header className="panel-head">
          <h2 className="panel-title">{title}</h2>
          {meta ? <div className="flex items-center gap-2">{meta}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Chip({
  tone = "neutral",
  children,
  title,
}: {
  tone?: "neutral" | "cyan" | "violet" | "amber" | "rose" | "emerald" | "blue";
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`chip ${tone === "neutral" ? "" : `chip-${tone}`}`} title={title}>
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
  align = "left",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "up" | "down" | "warn" | "accent";
  align?: "left" | "right";
}) {
  const toneClass =
    tone === "up"
      ? "text-emerald"
      : tone === "down"
        ? "text-rose"
        : tone === "warn"
          ? "text-amber"
          : tone === "accent"
            ? "text-cyan"
            : "text-ink";
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className="label">{label}</div>
      <div className={`num mt-1 text-[1.35rem] leading-none font-semibold ${toneClass}`}>{value}</div>
      {sub ? <div className="mt-1.5 text-[0.72rem] text-ink-3">{sub}</div> : null}
    </div>
  );
}

export function KeyValue({ label, value, title }: { label: string; value: ReactNode; title?: string }) {
  return (
    <div className="kv">
      <span className="text-[0.78rem] text-ink-3">{label}</span>
      <span className="num text-[0.82rem] text-ink-2" title={title}>
        {value}
      </span>
    </div>
  );
}

export function Bar({
  value,
  tone = "cyan",
  height = 6,
}: {
  value: number;
  tone?: "cyan" | "violet" | "amber" | "rose" | "emerald";
  height?: number;
}) {
  const width = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="w-full overflow-hidden rounded-full bg-line" style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${width}%`, background: `var(--color-${tone})` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------- charts */

export function Sparkline({
  values,
  width = 120,
  height = 28,
  tone = "var(--color-cyan)",
  fill = true,
  baseline,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: string;
  fill?: boolean;
  baseline?: number;
}) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const lo = Math.min(...values, baseline ?? Number.POSITIVE_INFINITY);
  const hi = Math.max(...values, baseline ?? Number.NEGATIVE_INFINITY);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - ((v - lo) / span) * (height - 2) - 1;
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const gradientId = `spark-${tone.replace(/[^a-z]/gi, "")}-${values.length}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.28" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill ? <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${gradientId})`} /> : null}
      {baseline !== undefined ? (
        <line x1="0" x2={width} y1={y(baseline)} y2={y(baseline)} stroke={tone} strokeOpacity="0.25" strokeDasharray="3 3" />
      ) : null}
      <path d={line} fill="none" stroke={tone} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r="2" fill={tone} />
    </svg>
  );
}

/* --------------------------------------------------------------------- icons */

type IconProps = { className?: string; size?: number };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconLive({ className = "", size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...stroke}>
      <path d="M2 12h4l3-7 4 14 3-7h6" />
    </svg>
  );
}

export function IconTimeline({ className = "", size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...stroke}>
      <path d="M3 3v18" />
      <path d="M3 16l5-5 4 3 6-7" />
      <circle cx="8" cy="11" r="1.4" />
      <circle cx="12" cy="14" r="1.4" />
    </svg>
  );
}

export function IconBrain({ className = "", size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...stroke}>
      <path d="M12 5.5a3 3 0 0 0-6 0A3 3 0 0 0 3.5 11a3 3 0 0 0 1 5.5A3 3 0 0 0 9.5 20a2.5 2.5 0 0 0 2.5-1.6z" />
      <path d="M12 5.5a3 3 0 0 1 6 0A3 3 0 0 1 20.5 11a3 3 0 0 1-1 5.5A3 3 0 0 1 14.5 20a2.5 2.5 0 0 1-2.5-1.6z" />
      <path d="M12 5.5V21" />
    </svg>
  );
}

export function IconRuns({ className = "", size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...stroke}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </svg>
  );
}

export function IconShield({ className = "", size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...stroke}>
      <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconFly({ className = "", size = 20 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...stroke}>
      <circle cx="12" cy="9" r="2.4" />
      <path d="M9.6 7.2C7.4 5.2 4.2 4.4 2.6 4.6c-.2 1.6.6 4.8 2.6 7" />
      <path d="M14.4 7.2c2.2-2 5.4-2.8 7-2.6.2 1.6-.6 4.8-2.6 7" />
      <path d="M12 11.6V16" />
      <path d="M9.4 14.6h5.2" />
    </svg>
  );
}

export function IconAlert({ className = "", size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...stroke}>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4" />
      <path d="M12 17.2v.1" />
    </svg>
  );
}

export const NAV = [
  { href: "/", label: "Live", Icon: IconLive },
  { href: "/timeline", label: "Timeline", Icon: IconTimeline },
  { href: "/neural", label: "Neural", Icon: IconBrain },
  { href: "/runs", label: "Runs", Icon: IconRuns },
  { href: "/compare", label: "Compare", Icon: IconTimeline },
  { href: "/integrity", label: "Integrity", Icon: IconShield },
];
