import { loadRun } from "@/lib/source";
import { shortHash } from "@/lib/format";
import { PageHeader, Caveat } from "@/components/PageHeader";
import { Chip, KeyValue, Panel, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const CAVEATS = [
  "The retained MaleCNS v1.0 graph is complete: 166,700 neurons, 25,582,938 directed connections, 124,177,617 synaptic contacts. Nothing is pruned to make it faster.",
  "The retina is an explicit display adapter: photoreceptors and lamina are graded in real flies and spiking here. RGB channels, sample locations and the lamina bias are modelling choices, not measured optics.",
  "The decoder is engineered, not discovered. Mean right minus mean left DNp20 firing past ±2 Hz with a DNpe017 spike is a fixed interface chosen by the authors.",
  "Reinforcement is an engineered input to identified dopamine cells. Pain receptors, subjective pain, pleasure and consciousness are not modeled or measured.",
  "No profitable learning, strategy improvement, biological replication or live-funded performance has been demonstrated by this repository's tests.",
];

export default async function IntegrityPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run: runName } = await searchParams;
  const data = await loadRun(runName);
  const provenance = data.provenance;
  const last = data.events.at(-1);
  const settings = (provenance?.settings ?? {}) as Record<string, string | number | boolean>;

  return (
    <>
      <PageHeader
        run={data.run}
        title="Integrity"
        subtitle="What was actually verified, what is assumed, and what has not been demonstrated. This page exists so the caveats travel with the numbers."
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Panel title="Dataset">
          {provenance ? (
            <>
              <Stat
                label="Release"
                value={provenance.dataset.release}
                sub={`${provenance.dataset.neurons.toLocaleString("en-US")} neurons`}
              />
              <div className="mt-3">
                <KeyValue label="Directed edges" value={provenance.dataset.directed_edges.toLocaleString("en-US")} />
                <KeyValue
                  label="Arrays verified"
                  value={
                    provenance.dataset.arrays_verified ? (
                      <span className="text-emerald">all match locks</span>
                    ) : (
                      <span className="text-rose">mismatch</span>
                    )
                  }
                />
                <KeyValue label="Feed" value={provenance.feed} />
              </div>
            </>
          ) : (
            <p className="text-[0.82rem] text-ink-3">No provenance.json in this run.</p>
          )}
        </Panel>

        <Panel title="Demonstrated">
          <div className="space-y-2">
            <Verdict label="Profitable learning" ok={provenance?.learning_validated ?? false} />
            <Verdict label="Pain receptors modeled" ok={provenance?.pain_receptors_modeled ?? false} />
            <Verdict label="Graph integrity" ok={provenance?.dataset.arrays_verified ?? false} />
            <Verdict label="Mechanism: sensory → memory" ok={Boolean(last)} />
          </div>
          <p className="mt-3 text-[0.7rem] leading-relaxed text-ink-3">
            The first two are expected to read NO. They are properties the repository explicitly does
            not claim, rendered as first-class readouts.
          </p>
        </Panel>

        <Panel title="Decoder">
          <p className="text-[0.78rem] leading-relaxed text-ink-2">{provenance?.decoder ?? "—"}</p>
          <div className="mt-3">
            <KeyValue label="Threshold" value={`${settings.decoder_threshold_hz ?? "—"} Hz`} />
            <KeyValue label="Neural time / tick" value={`${settings.neural_ms ?? "—"} ms`} />
            <KeyValue label="Pulse" value={`${settings.pulse_ms ?? "—"} ms`} />
          </div>
        </Panel>

        <Panel title="This tick's digests">
          {last ? (
            <>
              <KeyValue label="Spikes" value={shortHash(last.neural.spike_sha256, 12)} title={last.neural.spike_sha256} />
              <KeyValue label="Input image" value={shortHash(last.neural.input_sha256, 12)} title={last.neural.input_sha256} />
              <KeyValue label="Weights" value={shortHash(last.neural.memory.sha256, 12)} title={last.neural.memory.sha256} />
              <KeyValue label="Model" value={last.neural.memory.model} />
            </>
          ) : (
            <p className="text-[0.82rem] text-ink-3">No observations yet.</p>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Declared settings" meta={<Chip>{Object.keys(settings).length} values</Chip>}>
          <div className="grid gap-x-6 md:grid-cols-2">
            {Object.entries(settings).map(([key, value]) => (
              <KeyValue key={key} label={key} value={String(value)} />
            ))}
          </div>
        </Panel>

        <Panel title="Source fingerprints" meta={<Chip>{Object.keys(provenance?.source_sha256 ?? {}).length} files</Chip>}>
          <div className="max-h-[320px] overflow-y-auto">
            {Object.entries(provenance?.source_sha256 ?? {}).map(([file, hash]) => (
              <KeyValue key={file} label={file} value={shortHash(hash, 12)} title={hash} />
            ))}
          </div>
          <p className="mt-2 text-[0.7rem] leading-relaxed text-ink-3">
            Changing any file under stonkfly/ changes the run signature and the worker refuses to
            resume. A new experiment gets a new run directory.
          </p>
        </Panel>
      </div>

      <div className="mt-4 space-y-2">
        {CAVEATS.map((caveat) => (
          <Caveat key={caveat}>{caveat}</Caveat>
        ))}
      </div>
    </>
  );
}

function Verdict({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-line-soft bg-void/50 px-2.5 py-1.5">
      <span className="text-[0.78rem] text-ink-2">{label}</span>
      <span className={`num text-[0.72rem] font-semibold ${ok ? "text-emerald" : "text-amber"}`}>
        {ok ? "YES" : "NO"}
      </span>
    </div>
  );
}
