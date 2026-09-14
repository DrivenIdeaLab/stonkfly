"""Generate a synthetic-but-faithful Stonkfly run for UI development.

The events emitted here match the schema written by stonkfly/cli.py exactly, and
the frames are rendered by a copy of stonkfly/display.py:market_frame so the
console can be developed against realistic data without touching a real run.

EVERYTHING HERE IS SYNTHETIC. It is an accelerated probe (the equivalent of
`--fixture --fast`), not market data and not a backtest. The console labels it.
"""
import json
import random
from decimal import Decimal, ROUND_DOWN, ROUND_UP
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
FRAMES = ROOT / "public" / "frames"
SEED = 20260914
TICKS = 96
PRODUCT = "BTC-USDC"

# Mirrors Settings defaults in stonkfly/config.py.
CAPITAL = Decimal("100")
ORDER_LIMIT = Decimal("10")
FEE_RESERVE = Decimal("0.02")
PAPER_FEE = Decimal("0.006")
SLIPPAGE = Decimal("0.005")
SPREAD_LIMIT = Decimal("0.005")
LOSS_STOP = Decimal("20")
DAILY_ORDERS = 24
COOLDOWN = 60
BASE_INCREMENT = Decimal("0.00000001")
QUOTE_INCREMENT = Decimal("0.01")
PRICE_INCREMENT = Decimal("0.01")
MINIMUM_QUOTE = Decimal("1")
MINIMUM_BASE = Decimal("0.00000001")


def down(value, step):
    return (Decimal(value) / Decimal(step)).to_integral_value(rounding=ROUND_DOWN) * Decimal(step)


def up(value, step):
    return (Decimal(value) / Decimal(step)).to_integral_value(rounding=ROUND_UP) * Decimal(step)


def market_frame(product, history, bid, ask):
    """Byte-for-byte reimplementation of stonkfly/display.py:market_frame."""
    im = Image.new("RGB", (320, 180), (235, 240, 249))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 319, 27), fill=(19, 36, 71))
    d.text((9, 8), product, fill=(219, 229, 249))
    for x in range(12, 310, 30):
        d.line((x, 34, x, 160), fill=(200, 212, 233))
    for y in range(38, 162, 24):
        d.line((10, y, 308, y), fill=(200, 212, 233))
    values = [float(v) for v in history[-100:]]
    if len(values):
        # np.ptp / np.mean, written out so this tool only needs Pillow.
        span = max(max(values) - min(values), sum(values) / len(values) * 0.002)
        lo = min(values) - span * 0.12
        span *= 1.24
        points = [
            (12 + i * 294 / max(1, len(values) - 1), 153 - (v - lo) / span * 109)
            for i, v in enumerate(values)
        ]
        if len(points) > 1:
            for a, b in zip(points, points[1:]):
                d.line((*a, *b), fill=(0, 101, 183) if b[1] <= a[1] else (197, 37, 78), width=3)
        for x, y in points:
            d.rectangle((x - 1, y - 1, x + 1, y + 1), fill=(27, 39, 81))
    d.text((9, 165), f"BID {bid}  ASK {ask}"[:50], fill=(28, 46, 82))
    return im


def main():
    rng = random.Random(SEED)
    FRAMES.mkdir(parents=True, exist_ok=True)
    for stale in FRAMES.glob("tick-*.png"):
        stale.unlink()

    # --- price history: seed with 120 synthetic one-minute closes -----------
    price = Decimal("64180.00")
    history = []
    for i in range(120):
        drift = Decimal(str(rng.gauss(0.00004, 0.0009)))
        price = price * (Decimal(1) + drift)
        history.append(float(price))

    cash = CAPITAL
    positions = {PRODUCT: Decimal("0")}
    anchor = CAPITAL
    equity = CAPITAL
    last_attempt = 0.0
    wall = 1_766_000_000.0  # fixed synthetic epoch, readable in the UI
    attempts_today = 0
    changed_edges = 0
    difference = 1.1
    events = []

    for tick in range(1, TICKS + 1):
        # --- market observation -------------------------------------------
        mid = Decimal(str(history[-1]))
        half_spread = Decimal(str(rng.uniform(0.00018, 0.00042)))
        bid = (mid * (Decimal(1) - half_spread)).quantize(Decimal("0.01"))
        ask = (mid * (Decimal(1) + half_spread)).quantize(Decimal("0.01"))
        quote_ts = wall
        quote = {
            "product": PRODUCT,
            "bid": str(bid),
            "ask": str(ask),
            "timestamp": quote_ts,
            "base_increment": str(BASE_INCREMENT),
            "quote_increment": str(QUOTE_INCREMENT),
            "price_increment": str(PRICE_INCREMENT),
            "minimum_quote": str(MINIMUM_QUOTE),
            "minimum_base": str(MINIMUM_BASE),
        }

        # --- marked-to-bid equity and the engineered stimulus --------------
        previous_equity = equity
        equity = cash + positions[PRODUCT] * bid
        delta = equity - anchor
        if delta >= Decimal("0.01"):
            stimulus = "reward"
        elif delta <= Decimal("-0.01"):
            stimulus = "aversive"
        else:
            stimulus = "none"

        # --- neural integration (synthetic, plausible magnitudes) ----------
        # Validation observed 11-16 KC spikes per observation and a persistent
        # rightward DNp20 bias that turned into repeated BUY proposals.
        compute_seconds = round(rng.uniform(6.1, 7.6), 3)
        difference = max(-7.0, min(7.0, difference * 0.82 + rng.gauss(1.15, 2.0)))
        left_hz = round(max(0.0, rng.gauss(2.4, 0.9)), 3)
        right_hz = round(max(0.0, left_hz + difference), 3)
        gate_spikes = rng.choice([0, 1, 1, 1, 2, 3])
        side = (
            "HOLD"
            if gate_spikes == 0 or abs(right_hz - left_hz) < 2
            else ("BUY" if right_hz - left_hz > 0 else "SELL")
        )
        kc_spikes = rng.randint(11, 16)
        total_spikes = rng.randint(58_000, 74_000)
        reward_spikes = rng.randint(4, 21) if stimulus == "reward" else rng.randint(0, 9)
        aversive_spikes = rng.randint(38, 74) if stimulus == "aversive" else rng.randint(0, 11)
        changed_edges = max(0, changed_edges + rng.choice([-1, 0, 0, 1, 1, 2]))
        mean_efficacy = round(1.0 + rng.uniform(-0.006, 0.004), 6)
        minimum_efficacy = round(max(0.1, 1.0 - rng.uniform(0.004, 0.031)), 6)
        neural = {
            "side": side,
            "left_hz": left_hz,
            "right_hz": right_hz,
            "difference_hz": round(right_hz - left_hz, 3),
            "gate_spikes": gate_spikes,
            "cell_ids": {  # synthetic bodyIds; a real run reports MaleCNS ids
                "left": [str(rng.randint(11000, 99999)) for _ in range(6)],
                "right": [str(rng.randint(11000, 99999)) for _ in range(6)],
                "gate": [str(rng.randint(11000, 99999)) for _ in range(4)],
            },
            "brain_ms": 500.0,
            "compute_seconds": compute_seconds,
            "stimulus": stimulus,
            "stimulus_ms": 200.0 if stimulus != "none" else 0.0,
            "reward_spikes": reward_spikes,
            "aversive_spikes": aversive_spikes,
            "KC_spikes": kc_spikes,
            "total_spikes": total_spikes,
            "spike_sha256": "".join(rng.choice("0123456789abcdef") for _ in range(64)),
            "input_sha256": "".join(rng.choice("0123456789abcdef") for _ in range(64)),
            "memory": {
                "plastic_edges": 7835,
                "changed_edges": changed_edges,
                "mean_efficacy": mean_efficacy,
                "minimum_efficacy": minimum_efficacy,
                "sha256": "".join(rng.choice("0123456789abcdef") for _ in range(64)),
                "model": "stonkfly-dual-compartment-v1",
            },
        }

        # --- guard + paper execution ---------------------------------------
        order = {"status": "HOLD"}
        if side != "HOLD":
            if wall - last_attempt < COOLDOWN:
                order = {"status": "VETO", "reason": "Order cooldown"}
            elif attempts_today >= DAILY_ORDERS:
                order = {"status": "VETO", "reason": "Daily order limit"}
            else:
                # A second book is fetched after integration; a big move vetoes.
                fresh_bid = bid * (Decimal(1) + Decimal(str(rng.gauss(0, 0.0016))))
                if abs(fresh_bid - bid) / bid > SLIPPAGE:
                    order = {
                        "status": "VETO",
                        "reason": "Price moved beyond neural observation tolerance",
                    }
                elif side == "BUY":
                    limit = up(ask * (Decimal(1) + SLIPPAGE), PRICE_INCREMENT)
                    budget = min(ORDER_LIMIT, cash) / (Decimal(1) + FEE_RESERVE)
                    size = down(budget / limit, BASE_INCREMENT)
                    if size < MINIMUM_BASE or size * limit < MINIMUM_QUOTE:
                        order = {
                            "status": "VETO",
                            "reason": "Insufficient funds/position or below exchange minimum",
                        }
                    else:
                        value = size * Decimal(str(ask))
                        fee = value * PAPER_FEE
                        cash -= value + fee
                        positions[PRODUCT] += size
                        last_attempt = wall
                        attempts_today += 1
                        order = {
                            "mode": "paper",
                            "status": "FILLED",
                            "base": str(size),
                            "quote": str(value.quantize(Decimal("0.00000001"))),
                            "fee": str(fee.quantize(Decimal("0.00000001"))),
                        }
                else:
                    size = down(
                        min(positions[PRODUCT], ORDER_LIMIT / Decimal(str(ask))), BASE_INCREMENT
                    )
                    if size < MINIMUM_BASE or size * Decimal(str(bid)) < MINIMUM_QUOTE:
                        order = {
                            "status": "VETO",
                            "reason": "Insufficient funds/position or below exchange minimum",
                        }
                    else:
                        limit = down(bid * (Decimal(1) - SLIPPAGE), PRICE_INCREMENT)
                        value = size * limit
                        fee = value * PAPER_FEE
                        cash += value - fee
                        positions[PRODUCT] -= size
                        last_attempt = wall
                        attempts_today += 1
                        order = {
                            "mode": "paper",
                            "status": "FILLED",
                            "base": str(size),
                            "quote": str(value.quantize(Decimal("0.00000001"))),
                            "fee": str(fee.quantize(Decimal("0.00000001"))),
                        }

        equity = cash + positions[PRODUCT] * bid
        events.append(
            {
                "tick": tick,
                "wall_time": wall,
                "product": PRODUCT,
                "mode": "paper",
                "quote": quote,
                "equity_usdc": str(equity.quantize(Decimal("0.00000001"))),
                "pnl_delta_usdc": str(delta.quantize(Decimal("0.00000001"))),
                "neural": neural,
                "execution": order,
            }
        )

        market_frame(PRODUCT, history, bid, ask).save(FRAMES / f"tick-{tick:04d}.png")
        history.append(float((bid + ask) / 2))
        history = history[-120:]
        anchor = equity
        # Accelerated probe: no wall wait, so observations are compute-bound.
        wall += compute_seconds

    status = {
        "mode": "paper",
        "tick": TICKS,
        "cash": str(cash.quantize(Decimal("0.00000001"))),
        "positions": {PRODUCT: str(positions[PRODUCT])},
        "initial_cash": str(CAPITAL),
        "anchor": str(anchor.quantize(Decimal("0.00000001"))),
        "halted": None,
    }

    provenance = {
        "settings": {
            "products": [PRODUCT],
            "capital": str(CAPITAL),
            "order_limit": str(ORDER_LIMIT),
            "loss_stop": str(LOSS_STOP),
            "fee_reserve": str(FEE_RESERVE),
            "slippage": str(SLIPPAGE),
            "spread_limit": str(SPREAD_LIMIT),
            "daily_orders": DAILY_ORDERS,
            "interval_seconds": COOLDOWN,
            "max_quote_age": 15,
            "neural_ms": 500,
            "neural_bin_ms": 10,
            "pulse_ms": 200,
            "pulse_current": 20,
            "reward_deadband": "0.01",
            "decoder_threshold_hz": 2,
            "paper_fee": str(PAPER_FEE),
            "learning": True,
        },
        "dataset": {
            "release": "MaleCNS v1.0",
            "neurons": 166700,
            "directed_edges": 25582938,
            "arrays_verified": True,
        },
        "vision": {
            "retina_total": 3335,
            "retina_mapped": 3335,
            "r8_mapped": 811,
            "retina_model": "R1-R6 luminance-only; column inferred from contacts onto annotated L1/L2/L3.",
        },
        "mode": "paper",
        "feed": "synthetic-fixture",
        "decoder": "DNp20 mean R-L: buy/sell; DNpe017 spike gate; otherwise hold. Engineered fixed mapping.",
        "learning_validated": False,
        "pain_receptors_modeled": False,
        "timing": "Each observation advances configured neural_ms regardless of wall-market time; no claim of real-time fly physiology.",
        "source_sha256": {"stonkfly/cli.py": "fixture", "stonkfly/neural/kernel.cpp": "fixture"},
    }

    (ROOT / "lib" / "fixture-events.json").write_text(json.dumps(events, indent=1) + "\n")
    (ROOT / "lib" / "fixture-status.json").write_text(json.dumps(status, indent=2) + "\n")
    (ROOT / "lib" / "fixture-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")

    fills = sum(1 for e in events if e["execution"].get("status") == "FILLED")
    vetoes = sum(1 for e in events if e["execution"].get("status") == "VETO")
    print(
        f"wrote {len(events)} events, {fills} fills, {vetoes} vetoes, "
        f"{len(list(FRAMES.glob('tick-*.png')))} frames -> {FRAMES}"
    )


if __name__ == "__main__":
    main()
