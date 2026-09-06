import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { usagePath } from "./usage";
// A sibling of the existing usage ledger; only daily aggregate counts, no receipts.
export const funnelPath = () => usagePath() + ".funnel.json";
type Ledger = { version: 1; days: Record<string, Record<string, number>> };
let queue: Promise<void> = Promise.resolve();
let pending = 0;
export async function readFunnel(path = funnelPath()): Promise<Ledger> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as Ledger;
    if (value.version !== 1 || !value.days || typeof value.days !== "object")
      throw Error("Invalid funnel ledger");
    return value;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      return { version: 1, days: {} };
    throw e;
  }
}
export function recordFunnel(
  event: string,
  dimensions: Record<string, string | number>,
) {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.FUNNEL_TEST_ENABLED !== "true"
  )
    return;
  if (pending >= 500) return;
  pending++;
  // Capture values at invocation, never read another request's context in the queue.
  const path = funnelPath();
  const day = new Date().toISOString().slice(0, 10);
  const key = JSON.stringify([
    event,
    dimensions.guide_id ?? "none",
    dimensions.source ?? "unknown",
    dimensions.is_example ?? 0,
    dimensions.entry_id ?? "none",
    dimensions.workbook_kind ?? "unknown",
    dimensions.entry_point ?? "internal",
    dimensions.action ?? "none",
    dimensions.support_verified ?? 0,
  ]);
  queue = queue
    .then(async () => {
      const ledger = await readFunnel(path);
      ledger.days[day] ??= {};
      const counts = ledger.days[day];
      if (Object.keys(counts).length >= 25000 && !(key in counts)) return;
      counts[key] = (counts[key] ?? 0) + 1;
      for (const d of Object.keys(ledger.days))
        if (d < new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
          delete ledger.days[d];
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const tmp = path + ".tmp";
      await writeFile(tmp, JSON.stringify(ledger), { mode: 0o600 });
      await rename(tmp, path);
    })
    .catch(() => {
      /* Metrics cannot break the tool. */
    })
    .finally(() => {
      pending--;
    });
}
export const flushFunnel = () => queue;
export async function funnelSummary() {
  await flushFunnel();
  const { days } = await readFunnel();
  return {
    definition:
      "Daily event counts, not unique users or conversion rates. example=1 is a server-resolved demo or synthetic supported analysis. Compatible real analyses: analysis_completed, workbook_kind=real, example=0, support_verified=1.",
    dimensions: [
      "event",
      "guide_id",
      "source",
      "is_example",
      "entry_id",
      "workbook_kind",
      "entry_point",
      "action",
      "support_verified",
    ],
    days,
    rows: Object.entries(days).flatMap(([day, counters]) =>
      Object.entries(counters).map(([key, count]) => {
        const [
          event,
          guide_id,
          source,
          is_example,
          entry_id,
          workbook_kind,
          entry_point,
          action,
          support_verified,
        ] = JSON.parse(key);
        return {
          day,
          event,
          guide_id,
          source,
          is_example,
          entry_id,
          workbook_kind,
          entry_point,
          action,
          support_verified,
          count,
        };
      }),
    ),
  };
}
