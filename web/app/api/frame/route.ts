import path from "node:path";
import { promises as fs } from "node:fs";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Serves the newest network input frame from a run directory. Read-only, and
 * hard-limited to the configured runs root so a crafted `run` value cannot
 * escape it.
 */
export async function GET(request: NextRequest) {
  const base = path.resolve(process.env.STONKFLY_RUNS_DIR ?? "/var/lib/stonkfly/runs");
  const requested = request.nextUrl.searchParams.get("run") ?? "paper";
  const file = path.resolve(base, path.basename(requested), "latest-input.png");

  if (file !== path.join(base, path.basename(requested), "latest-input.png")) {
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
