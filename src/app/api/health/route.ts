import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { config } from "../../../server/config";
import { startCleanup } from "../../../server/store";
import { usagePath } from "../../../server/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    for (const directory of [config().storeDir, dirname(usagePath())]) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await access(directory, constants.R_OK | constants.W_OK | constants.X_OK);
    }
    startCleanup();
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
