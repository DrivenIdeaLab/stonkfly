/**
 * Display helpers. Decimal strings in, strings out.
 *
 * The experiment keeps money in Decimal; a float round-trip in the console
 * would be the one place a balance could be shown wrong, so parsing happens
 * only for chart scales and only via `toChartNumber`.
 */

/** Parse a Decimal-ish string ("99.94", "1E-8", "-0.05852808") for geometry only. */
export function toChartNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

const PLAIN = /^-?\d+(\.\d+)?$/;

/** Fixed-decimal rendering straight off the string, so no precision is lost. */
export function decimal(value: string | number | undefined, places = 2): string {
  if (value === undefined) return "—";
  const raw = typeof value === "number" ? value.toString() : value;
  if (!PLAIN.test(raw)) {
    // Exponent notation ("1E-8", "0E-8") or something unexpected: normalise.
    const n = Number(raw);
    if (!Number.isFinite(n)) return raw;
    if (n !== 0 && Math.abs(n) < 1e-4) return n.toExponential(2);
    return n.toFixed(places);
  }
  const negative = raw.startsWith("-");
  const [whole, frac = ""] = raw.replace("-", "").split(".");
  const padded = frac.padEnd(places, "0").slice(0, places);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${places > 0 ? `${grouped}.${padded}` : grouped}`;
}

export function usdc(value: string | undefined, places = 2): string {
  return value === undefined ? "—" : `$${decimal(value, places)}`;
}

export function signed(value: string | undefined, places = 2): string {
  if (value === undefined) return "—";
  const n = toChartNumber(value);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}$${decimal(value.replace("-", ""), places)}`;
}

export function base(value: string | undefined, places = 8): string {
  return value === undefined ? "—" : decimal(value, places).replace(/0+$/, "").replace(/\.$/, "");
}

export function pct(value: number, places = 2): string {
  return `${(value * 100).toFixed(places)}%`;
}

export function compactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return Math.round(value).toLocaleString("en-US");
}

export function ago(timestamp: number | null, now = Date.now()): string {
  if (timestamp === null) return "never";
  const seconds = Math.max(0, Math.round((now - timestamp * 1000) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

export function clockTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("en-AU", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function shortHash(hash: string, size = 10): string {
  return hash.length <= size ? hash : `${hash.slice(0, size)}…`;
}

/** Veto reasons are the guard's own strings; shorten for chips, keep full text on hover. */
export function shortReason(reason: string): string {
  const map: Record<string, string> = {
    "Order cooldown": "cooldown",
    "Daily order limit": "daily limit",
    "Insufficient funds/position or below exchange minimum": "too small",
    "Price moved beyond neural observation tolerance": "price moved",
    "Spread limit": "spread",
    "Stale or future quote": "stale quote",
    "STOP file present": "STOP file",
    "Loss stop reached": "loss stop",
    "Quote expired before submission": "quote expired",
    "Coinbase preview rejected or warned": "preview rejected",
    "Fee ceiling exceeded": "fee ceiling",
  };
  return map[reason] ?? reason.toLowerCase();
}

export function percentOrDash(value: number, places = 1): string {
  if (!Number.isFinite(value)) return "—";
  const scaled = value * 100;
  const sign = scaled > 0 ? "+" : scaled < 0 ? "−" : "";
  return `${sign}${Math.abs(scaled).toFixed(places)}%`;
}
