import path from "node:path";
import { promises as fs } from "node:fs";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Serves network-input frames for a run. Read-only.
 *
 * Two modes:
 *  1. File mode (STONKFLY_SOURCE=file): serves latest-input.png from the
 *     configured runs root, hard-limited to that root so a crafted `run`
 *     cannot escape it.
 *  2. Observer mode (STONKFLY_SOURCE=http): proxies GET
 *     /api/runs/{run}/frame?tick=N from the observer. The page embeds this
 *     console-origin URL directly — embedding the observer's LAN address in
 *     browser HTML is mixed content behind the HTTPS front door and renders
 *     blank (the Phase-5 "Network Input shows nothing" bug).
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("run") ?? "paper";
  const tickParam = request.nextUrl.searchParams.get("tick");
  const name = path.basename(requested);

  // Observer mode: proxy the observer's archived frame, any tick.
  if (process.env.STONKFLY_SOURCE === "http" && process.env.STONKFLY_OBSERVER_URL) {
    const url = new URL(
      `/api/runs/${encodeURIComponent(name)}/frame`,
      process.env.STONKFLY_OBSERVER_URL,
    );
    if (tickParam !== null) url.searchParams.set("tick", tickParam);
    try {
      const upstream = await fetch(url, { cache: "no-store" });
      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      return new Response("No frame", { status: 404 });
    } catch {
      return new Response("Observer unreachable", { status: 502 });
    }
  }

  // File mode: the newest frame only, from disk.
  const base = path.resolve(process.env.STONKFLY_RUNS_DIR ?? "/var/lib/stonkfly/runs");
  const file = path.join(base, name, "latest-input.png");

  if (file !== path.join(base, name, "latest-input.png")) {
    return new Response("Invalid run", { status: 400 });
  }

  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("No frame", { status: 404 });
  }
}
