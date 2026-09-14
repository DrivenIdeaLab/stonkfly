# Stonkfly Console — design

Stonkfly ships **no** user interface. It is a headless CLI: a single-worker loop that writes to a
run directory, and the only "visual" in the whole codebase is `runs/<name>/latest-input.png` — the
320×180 chart that gets fed to the retina. There is no web server anywhere in the repo.

So the console in `web/` is not a hidden feature being surfaced. It is a **new, separate
observability surface** built on top of artifacts the worker already writes. That framing drives
every decision below.

## The one rule

**The console is read-only.** It never writes to a run directory.

`runs/` is experiment evidence: a WAL-mode SQLite ledger, two alternating checkpoints, an
append-only `events.jsonl` with an fsync per line, and a `provenance.json` whose signature makes the
worker refuse to resume if the source changes. A stray write from a web process could invalidate
provenance, fight the worker's `flock` on `worker.lock`, or corrupt the authoritative ledger. The UI
consequently has **no control surface at all** — no buttons that place, cancel or retry an order, and
no endpoint that writes anything.

Two consequences worth stating explicitly:

- The console reads `events.jsonl` / `latest.json` / `provenance.json` / `error.json` in preference
  to opening `ledger.sqlite`. Plain files need no locking, no WAL `-shm` access and no UID
  coordination with the worker.
- Because the worker keeps only `latest-input.png`, **historical frames do not exist**. Scrubbing the
  timeline can only show archived frames if something copies each tick's image out of the run
  directory — and that write belongs to an observer service, never to the worker.

## Architecture

Three ways to wire it up. The third is recommended for `dev2`.

| Option | Shape | For | Against |
| --- | --- | --- | --- |
| **A. Shared container** | Console runs in the Stonkfly LXC, `STONKFLY_SOURCE=file`, reads `runs/` directly as the `stonkfly` user | One container, no network hop, simplest path to a working UI | Web server shares CPU/RAM with a 25.6M-edge kernel; a bug in the observer is a bug next to the ledger |
| **B. Separate container + bind mount** | New LXC, console reads a **read-only** mount of `runs/` | Strong isolation; the UI physically cannot write to a run | **Unprivileged LXC UID mapping bites**: host files owned by `stonkfly` (uid 1000) appear as `nobody` inside a container mapped from 100000, so `0640` modes are unreadable. Needs a privileged container, an idmap tweak, or loosened permissions |
| **C. Separate container + observer API** ⭐ | A tiny read-only API runs beside the worker; the console talks HTTP to it | Cleanest isolation, no UID games, one place that can archive frames, console needs zero access to experiment data | Two services to run |

Option C in detail:

```
┌─ LXC stonkfly (existing) ─────────────┐        ┌─ LXC stonkfly-ui ──────┐
│  systemd: stonkfly-paper.service      │        │  systemd:              │
│    python -m stonkfly run             │        │    stonkfly-console    │
│                                       │  HTTP  │    (next start :3000)  │
│  systemd: stonkfly-observer.service   │ ─────► │                        │
│    read-only, :8787, own cache dir    │        │  reads: observer API   │
│    /var/lib/stonkfly/runs   (ro)      │        │  writes: nothing       │
└───────────────────────────────────────┘        └───────────┬────────────┘
                                                             │ HTTP
                                                    Nginx Proxy Manager
                                                             │
                                                      stonkfly.example.com
```

The observer is the **only** process allowed to write outside `runs/` — and what it writes is just its
own frame cache and parsed status, never experiment state.

### Observer API contract

Implemented by Hermes in the continuation prompt ([hermes-prompt.md](hermes-prompt.md)). All
responses are JSON; all endpoints are `GET`; nothing accepts a write.

| Endpoint | Returns |
| --- | --- |
| `GET /api/runs` | `RunSummary[]` |
| `GET /api/runs/{name}` | `RunSummary` (mode, ticks, lastTickAt, halted, hasError) |
| `GET /api/runs/{name}/events?after=&limit=` | `TickEvent[]`, newest last |
| `GET /api/runs/{name}/status` | `{mode, tick, cash, positions, initial_cash, anchor, halted}` |
| `GET /api/runs/{name}/provenance` | the run's `provenance.json` |
| `GET /api/runs/{name}/error` | `error.json`, or `404` |
| `GET /api/runs/{name}/frame?tick=N` | the archived `image/png`, or `404` |
| `GET /api/health` | `{ok, version, runsDir, readOnly}` |
| `WS /ws` | pushes new ticks as they are appended |

## Data contract

Everything the UI knows, it learned from one line of `events.jsonl` (written by `stonkfly/cli.py`):

```jsonc
{
  "tick": 41,
  "wall_time": 1766000312.4,
  "product": "BTC-USDC",
  "mode": "paper",
  "quote":  { "bid": "64320.49", "ask": "64349.04", "timestamp": 1766000312.4, … },
  "equity_usdc": "99.93679134",
  "pnl_delta_usdc": "-0.05852808",
  "neural": {
    "side": "BUY", "left_hz": 3.29, "right_hz": 8.07, "difference_hz": 4.78,
    "gate_spikes": 1, "cell_ids": { "left": [...], "right": [...], "gate": [...] },
    "brain_ms": 500, "compute_seconds": 6.81,
    "stimulus": "reward" | "aversive" | "none", "stimulus_ms": 200,
    "reward_spikes": 12, "aversive_spikes": 55, "KC_spikes": 14, "total_spikes": 72077,
    "spike_sha256": "…", "input_sha256": "…",
    "memory": { "plastic_edges": 7835, "changed_edges": 5, "mean_efficacy": 0.9998,
                "minimum_efficacy": 0.9812, "sha256": "…", "model": "stonkfly-dual-compartment-v1" }
  },
  "execution": { "status": "HOLD" }
              | { "status": "VETO", "reason": "Order cooldown" }
              | { "mode": "paper", "status": "FILLED", "base": "0.00015152", "quote": "9.754", "fee": "0.0585" }
}
```

Plus `status.json` (observer-written; same keys as `stonkfly status`), `provenance.json`,
`error.json`, `latest-input.png`.

**Money stays a string.** The app uses `Decimal` end-to-end (and even emits exponent notation like
`1E-8`). `lib/format.ts` renders balances straight off the string; only chart geometry converts to a
number, via `toChartNumber`. A float round-trip is the one place a displayed balance could be wrong.

## Visual system

Instrument panel, not trading terminal. Near-black blue, hairline borders, tabular-nums monospace for
every number, and a palette where each colour means exactly one thing:

| Token | Value | Means |
| --- | --- | --- |
| `cyan` | `#22d3ee` | sensory / vision / network input |
| `violet` | `#a78bfa` | reward dopamine (PAM11, α1) |
| `rose` | `#fb7185` | aversive dopamine (PPL101, γ1pedc) and losses |
| `amber` | `#fbbf24` | the guard refusing something |
| `emerald` | `#34d399` | an order that actually filled |
| `blue` | `#60a5fa` | market price |
| `ink / ink-2 / ink-3` | `#e9eefb / #9aabc4 / #5f6f8a` | primary / secondary / tertiary text |

Surfaces: `void #05080d`, `bg #0a0e15`, `panel #0f1521`, `line #1d2839`. The body carries two faint
radial glows and a 46px engineering grid masked out toward the bottom. Charts are hand-rolled SVG —
at one observation per minute there is no need for a chart library, and owning the pixels keeps the
instrument look consistent. No chart dependency, no animation library, no component library: Next 15
+ React 19 + Tailwind v4 + TypeScript.

### Five design decisions that matter

1. **The hero is what the fly sees.** `latest-input.png` at the top, rendered pixel-exact
   (`image-rendering: pixelated`) at its true 320×180, in a HUD bezel with corner ticks and a
   scanline overlay. The caption states the sample counts: 3,335 R1–R6 luminance + 811 R8 colour.
   Resampling it to look "nicer" would hide a real property of the experiment.
2. **The decoder boundary is drawn, not described.** A ±8 Hz meter with the ±2 Hz deadband shaded and
   the last 28 readings as faint ticks. A persistent circuit bias becomes *visible as bias* — the
   single most important thing to notice about this system, and invisible in a table of numbers.
3. **Refusals are a feature.** The guard's vetoes are the most informative signal available, so veto
   reasons get their own tally chips and the outcome card explains that a refusal ends the tick and
   never becomes a different order.
4. **Liveness is a first-class readout.** A headless experiment's classic failure is dying silently.
   The heartbeat measures *freshness of the newest observation*, not process state, and degrades
   streaming → stale → stopped.
5. **Caveats travel with the numbers.** `learning_validated: false` and `pain_receptors_modeled:
   false` are rendered as first-class YES/NO verdicts on the Integrity page, next to dataset
   verification. Synthetic data gets an amber `SYNTHETIC` badge everywhere it appears.

## Information architecture

| Route | Purpose |
| --- | --- |
| `/` **Live** | KPI strip (equity, change, drawdown vs the $20 stop, cash, observations, compute/tick), the network input, the decoder meter, reinforcement pulses, the guard panel, plasticity, equity chart, observation log |
| `/timeline` | Scrub any tick: the frame shown, the numbers produced, the outcome, and that tick's spike/image/weight digests |
| `/neural` | DNp20 differential over time with the deadband band, the actual cell IDs being read, KC and gate activity, reinforcement counts, plasticity over time |
| `/runs` | Every run directory with mode, tick count, freshness and health |
| `/integrity` | Dataset verification, demonstrated/not-demonstrated verdicts, the decoder text, declared settings, source fingerprints, and the five caveats |

Sidebar nav, page header carrying the mode badge + heartbeat + run name, and a `LiveRefresher` that
re-fetches server components every 15s (click to pause).

## Fixtures

`web/tools/generate_fixture.py` emits a synthetic but structurally faithful run: `lib/fixture-*.json`
plus one PNG per tick rendered by a byte-for-byte port of `stonkfly/display.py:market_frame`. It
models an **accelerated probe** (the `--fixture --fast` shape), which is why it shows one fill
followed by a run of cooldown vetoes — exactly the pattern `docs/validation.md` describes.

It is synthetic and labelled as such. Regenerate with:

```sh
pip install Pillow
python3 web/tools/generate_fixture.py
```

## Deployment behind Nginx Proxy Manager

1. `npm ci && npm run build`, then run `next start -H 0.0.0.0 -p 3000` under systemd (`web/.env`
   from `web/.env.example`).
2. Give the console LXC a static IP or DHCP reservation on `vmbr0`. No inbound port beyond 3000 from
   the proxy.
3. NPM → **Proxy Hosts → Add**:
   - Domain: `stonkfly.example.com` (a dedicated hostname; see the subpath note below)
   - Scheme `http`, Forward Hostname = console LXC IP, Forward Port `3000`
   - **Websockets Support: on** (needed once the `WS /ws` stream lands)
   - Block Common Exploits: on. **Cache Assets: off** (it would serve stale ticks)
   - SSL tab → request a Let's Encrypt certificate, Force SSL
4. **Auth:** NPM's *Access Lists* (HTTP basic) on the proxy host. The console deliberately ships no
   login; equity and balances are private enough to want one, and NPM already solves it.
5. If Hermes adds SSE instead of WebSockets, NPM buffers responses by default. Advanced → Custom
   Nginx Configuration:

   ```nginx
   proxy_buffering off;
   proxy_cache off;
   proxy_read_timeout 3600s;
   chunked_transfer_encoding on;
   proxy_set_header Connection '';
   ```

**Subpath note:** serving under `https://host/stonkfly/` requires `basePath` + `assetPrefix` in
`next.config.ts` and matching NPM `location` rules. A dedicated hostname avoids all of it and is the
recommendation.

## Security posture

- No control surface: nothing in the app can place, cancel or retry an order.
- No secrets in the payload. `events.jsonl` carries no keys, no portfolio IDs, no account numbers —
  only prices, quantities and hashes.
- `app/api/frame` resolves against the configured runs root and rejects anything that escapes it.
- Security headers (`nosniff`, `no-referrer`, `SAMEORIGIN`) are set in `next.config.ts`;
  `X-Powered-By` is off.
- The observer (Option C) should bind to the container IP, not `0.0.0.0`, and the console container
  should be the only client.

## Status

Built: all five routes, the data layer with three source modes, the fixture generator, decimal-safe
formatting, the design system, NPM deployment notes.

Not built (see the continuation prompt): the observer service, WebSocket/SSE live updates, frame
archiving for historical scrubbing, multi-run comparison, tests, and the two systemd units.
