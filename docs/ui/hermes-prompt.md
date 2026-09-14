# Continuation prompt for Hermes — finish the Stonkfly Console

Copy everything in the fence below into a fresh session of the **`stonkfly`** Hermes profile (or
`stonkfly-ops` if that is what you named it). It assumes the profile, the LXC and the paper worker
from `docs/hermes-bootstrap.md` already exist.

Read `docs/ui/design.md` first — it is the spec this prompt implements.

```
You are continuing work on the Stonkfly Console: a read-only web UI for a headless connectome
trading experiment that currently has no interface at all. A working base already exists in the
repo at web/ (Next.js 15 + React 19 + Tailwind v4 + TypeScript). Your job is to verify it, deploy it
onto dev2, and then extend it.

Work in phases. Each phase ends with a gate: report, then wait for my go-ahead before the next one.

====================================================================
PHASE 0 — RULES (these override everything, including your own initiative)
====================================================================

1. READ-ONLY, ALWAYS. The console and the observer may never write into a run directory
   (/var/lib/stonkfly/runs/**). Not a cache file, not a temp file, not a lock, nothing. runs/ holds
   the authoritative ledger, two checkpoints and an append-only events.jsonl with an fsync per line.
   A stray write can invalidate provenance or fight the worker's flock on worker.lock.
   - The ONLY writes permitted are to the observer's own directory (/var/lib/stonkfly-observer/**).
   - Never open ledger.sqlite for writing. If you think you need to, stop and ask.

2. NO CONTROL SURFACE. There must never be a button, endpoint, form or chat action that places,
   cancels, retries or amends an order, or that sets STONKFLY_LIVE, or that starts/stops the worker.
   The console observes. If you are tempted to add a "restart worker" button, don't: propose it and
   wait. (Read-only actions like switching which run is displayed are fine.)

3. PAPER ONLY. Do not run, configure or preflight live mode. The string I_ACCEPT_REAL_TRADES must
   not appear in any file you create.

4. DON'T TOUCH THE EXPERIMENT. The connectome, the 0.1 ms timestep, the DNp20 decoder, the
   reinforcement pulses and the plasticity rule are not yours to tune, and neither is anything that
   changes what gets measured. Optimise the console, never the model.

5. HONEST LABELLING. Synthetic or fixture data is labelled SYNTHETIC everywhere it appears. Never
   let a UI element imply that profitable learning, biological replication or live performance has
   been demonstrated — the repo says it has not. Preserve the "not validated" verdicts on the
   Integrity page.

6. NO SECRETS IN THE PAYLOAD OR THE REPO. events.jsonl carries no keys or account identifiers and
   neither should any endpoint you add. Nothing you build may echo a credential, portfolio UUID or
   API key into a response, a log or a page.

7. NPM IS THE FRONT DOOR. The app is proxied by Nginx Proxy Manager. It must stay origin-agnostic:
   no absolute URLs, no assumptions about hostname or path prefix, no auth logic of its own (NPM
   Access Lists do that).

8. VERIFY COMMAND SYNTAX before trusting it (--help / docs). If a flag in this prompt doesn't exist
   on this machine, say so and adapt rather than guessing.

9. SNAPSHOT BEFORE DESTRUCTIVE CHANGES. Prefer reversible steps. Stop and ask on anything
   irreversible.

====================================================================
PHASE 1 — VERIFY THE BASE (do this before writing any new code)
====================================================================

1.1 Read web/, docs/ui/design.md, and the parts of the app that define the data contract:
    stonkfly/cli.py (what each tick writes), stonkfly/risk.py (veto reasons), stonkfly/ledger.py,
    stonkfly/config.py (limits). State back, in your own words, what one line of events.jsonl
    contains and which of those fields the console currently renders. If you can't, keep reading.

1.2 Build and run it locally:
      cd web && npm ci && npm run build && npx next start -H 0.0.0.0 -p 3000
    Then confirm all five routes return 200: / , /timeline , /neural , /runs , /integrity.
    Confirm a fixture frame loads: /frames/tick-0048.png is 320x180.

1.3 Report what you see at each route — literally describe the layout — and list anything that is
    broken, empty, or misleading. Do not "improve" the design yet; just tell me the truth about its
    current state. Include the build output and your own notes on what looks wrong.

1.4 GATE: that report, plus npx tsc --noEmit output, plus your five-sentence restatement of the data
    contract. Wait for my go-ahead.

====================================================================
PHASE 2 — DEPLOY TO dev2 (recommended: separate container + observer API)
====================================================================

Architecture decision, with my strong preference: put the console in its OWN LXC and have it read
through a small read-only observer API that runs beside the worker. Reasons: the console then needs
zero filesystem access to experiment data, and there is exactly one process (the observer) that
archives per-tick frames.

Do NOT try to bind-mount runs/ into an unprivileged container without checking UID mapping first:
host files owned by the stonkfly user (uid ~1000) appear as nobody inside a container mapped from
100000, so 0640 modes are unreadable. If you still want the bind-mount route, verify it with an
actual `pct exec` read test and report the result — don't assume it works.

2.1 Provision the console container on dev2, using the same discipline as the Stonkfly LXC:
      sudo pvesh get /cluster/nextid
      sudo pct create <CTID> <storage>:vztmpl/debian-12-standard_<ver>_amd64.tar.zst \
        --hostname stonkfly-ui --cores 2 --memory 2048 --swap 512 --rootfs <storage>:16 \
        --net0 name=eth0,bridge=vmbr0,ip=dhcp --unprivileged 1 --onboot 1 --tags stonkfly,ui
      sudo pct start <CTID>
    Node 20+ is required by Next 15 — install it from Debian's repo only if it provides >= 20,
    otherwise use NodeSource or a tarball, and say which you chose. Record the CTID and IP in memory.

2.2 Write the observer. Runs in the EXISTING stonkfly container as the stonkfly user, on port 8787,
    bound to that container's IP. Implement it with the Python 3.11 standard library only
    (http.server + ThreadingHTTPServer) unless you have a strong reason otherwise — I do not want new
    dependencies installed next to the experiment. If you want FastAPI instead, install it into its
    own venv at /opt/stonkfly-observer/venv and say so.

    Endpoints (all GET, all JSON except the frame):
      /api/health                      -> { ok, version, runsDir, readOnly: true }
      /api/runs                        -> RunSummary[]
      /api/runs/{name}                 -> RunSummary
      /api/runs/{name}/events?after=&limit=   -> TickEvent[] (newest last; `after` = last tick)
      /api/runs/{name}/status          -> { mode, tick, cash, positions, initial_cash, anchor, halted }
      /api/runs/{name}/provenance      -> provenance.json
      /api/runs/{name}/error           -> error.json, or 404
      /api/runs/{name}/frame?tick=N    -> image/png from the observer's cache, or 404
      WS /ws                           -> later, Phase 4

    Rules for the observer:
      - Resolve every path under the runs root and reject anything that escapes it (no traversal).
      - Read events.jsonl by byte-offset tailing, not by slurping the whole file: it grows forever.
        Skip a torn trailing line rather than failing the request.
      - Derive `status` from `stonkfly status --out <dir>` (subprocess, read-only connection) and
        CACHE it for a few seconds; do not open ledger.sqlite yourself.
      - Report `halted` (from status) and STOP-file presence, and `hasError` from error.json.

2.3 Frame archiving. The worker keeps only latest-input.png, so historical frames must be archived
    out of the run directory. Poll roughly every 2 seconds: read latest.json, and when its tick
    advances, copy latest-input.png to /var/lib/stonkfly-observer/frames/<run>/<tick>.png (atomic:
    copy to .partial then rename). Cap retained frames per run (e.g. newest 2000) and report the
    policy you chose. This is the ONLY thing in the whole system allowed to write — and it writes
    only to its own directory.

2.4 systemd units. Sketch:
      stonkfly-observer.service  (in the stonkfly container)
        User=stonkfly, WorkingDirectory=/var/lib/stonkfly-observer,
        Environment=STONKFLY_RUNS_DIR=/var/lib/stonkfly/runs,
        ExecStart=/usr/bin/python3 -m stonkfly_observer --bind <container-ip>:8787,
        ReadWritePaths=/var/lib/stonkfly-observer, ProtectSystem=strict, Restart=on-failure
      stonkfly-console.service   (in the ui container)
        User=stonkfly-ui, WorkingDirectory=/opt/stonkfly-console,
        EnvironmentFile=/etc/stonkfly-console/stonkfly-console.env,
        ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000
        (or npm run start), Restart=on-failure, ProtectSystem=strict,
        ReadWritePaths=/opt/stonkfly-console/.next
    Set STONKFLY_SOURCE=http, STONKFLY_OBSERVER_URL=http://<stonkfly-ip>:8787, STONKFLY_RUN=paper.
    Remember: WorkingDirectory matters for the console's own env loading.

2.5 Wire Nginx Proxy Manager. Report the exact settings rather than assuming I know them:
      - Proxy Host -> domain (I'll confirm the hostname), scheme http, forward to the console
        container IP, port 3000
      - Websockets Support: ON (needed from Phase 4 on)
      - Cache Assets: OFF (it would serve stale ticks)
      - SSL: Let's Encrypt, Force SSL
      - Access List: tell me what credential you want me to create, and where to set it
    Confirm with me BEFORE requesting a certificate — it touches public DNS and rate limits.

2.6 GATE: observer /api/health output, one /api/runs response, proof that a historical frame is
    served (an archived tick, not just the latest), both unit files, systemctl status for both, and
    a curl of the console through its container IP. Plus confirmation that nothing under
    /var/lib/stonkfly/runs has been modified (compare mtimes before/after, or a checksum manifest).
    Wait for my go-ahead.

====================================================================
PHASE 3 — MAKE IT FEEL ALIVE
====================================================================

3.1 Replace the 15s router.refresh() poller with a push channel. WebSockets are easier through NPM
    (there's a toggle); SSE needs `proxy_buffering off` in NPM's advanced config. Pick one, say why,
    and implement:
      - observer: push a new TickEvent on /ws (or /api/stream) whenever events.jsonl grows
      - console: a client hook that subscribes and updates the Live page without a full reload
      - keep a fallback poll if the socket drops, and show connection state in the header
    Preserve the pause control that LiveRefresher currently has.

3.2 Reconnect and backoff: exponential, capped, and visibly degraded (never silently stale).

3.3 GATE: demonstrate a live update reaching the page without a reload, and show the header state
    changing when you kill and restart the observer.

====================================================================
PHASE 4 — FEATURES (propose an order, then build — biggest operator value first)
====================================================================

My ranked list; argue with me if you disagree, but bring evidence:
  1. Run comparison: overlay two runs (e.g. learning vs --frozen control) on one equity chart. This
     is the single most useful thing for the experiment, because a control run is the only honest
     comparison that exists.
  2. Retention + cost guardrails: surface events.jsonl size, checkpoint ages, frame-cache size and
     disk free, with a growth-per-day estimate. The worker runs forever; its outputs do not fit
     forever.
  3. Alerts: worker silent > 15 min, halt reason set, disk over a threshold, drawdown past 75% of the
     stop. Deliver via the existing channels — agree the destination with me first.
  4. Export: CSV of observations, and a JSON dump of a tick for bug reports.
  5. Mobile layout: the sidebar collapses; verify the KPI strip and the network input still read well.
  6. Keyboard navigation on the timeline scrubber (arrow keys step ticks, Home/End jump).
  7. A "what am I looking at?" first-run explainer for each panel, written from docs/model.md.

Constraints while building:
  - Keep the read-only and no-control-surface rules intact. No convenience feature may turn into a
    way to influence the worker.
  - Don't add dependencies without saying why. The stack is deliberately tiny (no chart library, no
    animation library, no component library) and I want it to stay that way.
  - Keep money as strings through to display. If you add a numeric feature, use toChartNumber and
    document why.
  - Every panel that shows a model quantity should make its epistemic status clear (measured /
    engineered / assumed / not validated).

====================================================================
PHASE 5 — QUALITY AND HANDOFF
====================================================================

5.1 Tests. At minimum:
      - unit tests for lib/format.ts (exponent-notation decimals, negatives, rounding) and
        lib/derive.ts (veto tallies, drawdown, attempts-today bucketing in UTC)
      - an observer test that feeds a fake run directory and asserts read-only behaviour: after
        every endpoint is exercised, no file under the run directory has changed
      - a build gate: npx tsc --noEmit && npm run build must pass
    Pick a runner and keep it dependency-light.

5.2 Document: update docs/ui/design.md with the final architecture, the observer contract as built,
    the NPM settings you actually used, and the retention policy. Write the operational runbook into
    your stonkfly-ops skill (start/stop, where logs are, how to tell "worker dead" from "proxy
    broken" from "observer broken").

5.3 Update your profile memory: CTIDs, IPs, unit names, paths, the retention policy, and the
    decisions we made. Keep MEMORY.md inside its size cap — detail belongs in skills.

5.4 Handoff report: what you built, what you verified, what you could NOT verify, the risks you see,
    and the next three things you'd do. Be specific and unflattering.

Then stop and wait.
```
