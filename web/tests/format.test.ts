/**
 * Unit tests for lib/format.ts — run with `node --test` on Node >= 22.6
 * (TypeScript type-stripping, no transpiler, no dependencies).
 *
 * The critical property under test: money arrives as Decimal strings
 * (including exponent notation like "1E-8") and must render exactly —
 * no float round-trip may change a displayed balance.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  toChartNumber,
  decimal,
  usdc,
  signed,
  base,
  pct,
  compactNumber,
  ago,
  shortHash,
  shortReason,
  percentOrDash,
} from "../lib/format.ts";

test("toChartNumber parses plain decimals", () => {
  assert.equal(toChartNumber("99.93679134"), 99.93679134);
  assert.equal(toChartNumber("-0.05852808"), -0.05852808);
});

test("toChartNumber normalises exponent notation for geometry only", () => {
  assert.equal(toChartNumber("1E-8"), 1e-8);
  assert.equal(toChartNumber("0E-8"), 0);
});

test("toChartNumber never returns NaN or throws on junk", () => {
  assert.equal(toChartNumber(null), 0);
  assert.equal(toChartNumber(undefined), 0);
  assert.equal(toChartNumber("not-a-number"), 0);
});

test("decimal renders plain strings without float round-trip", () => {
  assert.equal(decimal("99.94"), "99.94");
  assert.equal(decimal("100"), "100.00");
  assert.equal(decimal("1234567.8", 2), "1,234,567.80");
});

test("decimal groups thousands and pads/truncates to places", () => {
  assert.equal(decimal("99.9", 4), "99.9000");
  assert.equal(decimal("99.99999", 2), "99.99"); // truncate, never round up silently
  assert.equal(decimal("0.5", 0), "0");
});

test("decimal normalises exponent notation for display", () => {
  // Shipped behaviour: values below 1e-4 render in exponential form so a
  // 1E-8 fee never collapses to "$0.00" — it stays visibly non-zero.
  assert.equal(decimal("1E-8", 8), "1.00e-8");
  assert.equal(decimal("1E-8", 2), "1.00e-8");
  assert.equal(decimal("0E-8", 2), "0.00");
  // Values >= 1e-4 fall back to fixed rendering
  assert.equal(decimal("2.5E-3", 4), "0.0025");
});

test("decimal handles negatives and undefined", () => {
  assert.equal(decimal("-0.05852808", 2), "-0.05");
  assert.equal(decimal("-0.05", 0), "-0");
  assert.equal(decimal(undefined), "—");
});

test("usdc prefixes $", () => {
  assert.equal(usdc("99.94"), "$99.94");
  assert.equal(usdc(undefined), "—");
});

test("signed uses typographic minus and explicit +", () => {
  assert.equal(signed("1.5"), "+$1.50");
  assert.equal(signed("-1.5"), "−$1.50");
  assert.equal(signed("0"), "$0.00"); // zero shows no sign
  assert.equal(signed(undefined), "—");
});

test("base strips trailing zeros so sizes stay short", () => {
  assert.equal(base("0.00015152000", 8), "0.00015152");
  assert.equal(base("1.00000000", 8), "1");
  assert.equal(base(undefined), "—");
});

test("pct formats ratios", () => {
  assert.equal(pct(0.1567), "15.67%");
  assert.equal(pct(-0.001, 1), "-0.1%");
});

test("compactNumber thresholds", () => {
  assert.equal(compactNumber(999), "999");
  assert.equal(compactNumber(1_500), "1.5k");
  assert.equal(compactNumber(2_000_000), "2.00M");
});

test("ago renders buckets, future clamps to 0s", () => {
  const now = Date.now();
  assert.equal(ago(null, now), "never");
  assert.equal(ago(now / 1000 - 5, now), "5s ago");
  assert.equal(ago(now / 1000 - 5, now), "5s ago"); // idempotent
  assert.equal(ago(now / 1000 - 120, now), "2m ago");
  assert.equal(ago(now / 1000 - 7_200, now), "2h ago");
  assert.equal(ago(now / 1000 - 86_400, now), "1d ago");
});

test("shortHash truncates with ellipsis", () => {
  assert.equal(shortHash("a".repeat(64)), "aaaaaaaaaa…");
  assert.equal(shortHash("short"), "short");
});

test("shortReason maps guard strings to chip labels", () => {
  assert.equal(shortReason("Order cooldown"), "cooldown");
  assert.equal(shortReason("Loss stop reached"), "loss stop");
  assert.equal(shortReason("Novel future reason"), "novel future reason"); // unknown → lowercase as-is
});

test("percentOrDash signs and dashes", () => {
  assert.equal(percentOrDash(0.05), "+5.0%");
  assert.equal(percentOrDash(-0.05), "−5.0%");
  assert.equal(percentOrDash(Number.NaN), "—");
});
