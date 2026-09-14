import type { TickEvent } from "@/lib/types";
import { clockTime } from "@/lib/format";
import { Chip } from "../ui";

/**
 * The hero: the exact RGB frame handed to the retina at this tick. Rendered
 * pixel-exact on purpose — 320x180 is the resolution the network receives, and
 * pretending otherwise would hide a real property of the experiment.
 */
export function FlyView({ event, frameUrl }: { event: TickEvent; frameUrl: string | null }) {
  const { neural, quote, tick, wall_time, product } = event;
  const tone =
    neural.side === "BUY" ? "text-violet" : neural.side === "SELL" ? "text-rose" : "text-ink-2";

  return (
    <section className="panel overflow-hidden">
      <header className="panel-head">
        <h2 className="panel-title">Network input</h2>
        <div className="flex items-center gap-2">
          <Chip tone="cyan">320 × 180 RGB</Chip>
          <Chip>tick #{tick}</Chip>
          <Chip>{clockTime(wall_time)}</Chip>
        </div>
      </header>

      <div className="p-4">
        <div className="frame-bezel">
          {frameUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={frameUrl}
              alt={`Chart shown to the network at tick ${tick}`}
              width={320}
              height={180}
              className="pixelated block aspect-[16/9] w-full"
            />
          ) : (
            <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 bg-void px-6 text-center">
              <span className="text-[0.85rem] text-ink-2">Frame not archived</span>
              <span className="max-w-md text-[0.72rem] leading-relaxed text-ink-3">
                The app keeps only <span className="num">latest-input.png</span>. Historical frames
                need an archiver that copies each tick&apos;s image out of the run directory — that
                is a write, so it belongs to the observer, never to the worker.
              </span>
            </div>
          )}
          <span className="corner left-1.5 top-1.5 border-t border-l" />
          <span className="corner right-1.5 top-1.5 border-t border-r" />
          <span className="corner bottom-1.5 left-1.5 border-b border-l" />
          <span className="corner right-1.5 bottom-1.5 border-b border-r" />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-[0.72rem] leading-relaxed text-ink-3">
            <span className="num text-ink-2">3,335</span> R1–R6 luminance samples ·{" "}
            <span className="num text-ink-2">811</span> R8 colour samples ·{" "}
            <span className="num text-ink-2">{neural.brain_ms} ms</span> of neural time advanced
          </p>
          <div className="flex items-center gap-3 text-[0.72rem]">
            <span className="text-ink-3">
              {product} <span className="num text-blue">{quote.bid}</span>
              <span className="text-ink-3"> / </span>
              <span className="num text-blue">{quote.ask}</span>
            </span>
            <span className={tone}>
              decided <span className="num font-semibold">{neural.side}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
