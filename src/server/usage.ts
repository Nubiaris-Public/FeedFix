import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";

export const outcomeSchema = z.enum(["YES", "NO", "NOT_YET"]);
export type Outcome = z.infer<typeof outcomeSchema>;
const countsSchema = z.object({
  corrected_files: z.number().int().nonnegative(),
  corrections: z.number().int().nonnegative(),
  YES: z.number().int().nonnegative(),
  NO: z.number().int().nonnegative(),
  NOT_YET: z.number().int().nonnegative(),
});
const segmentSchema = z.object({ real: countsSchema, synthetic: countsSchema });
const ledgerSchema = z.object({
  version: z.literal(1),
  days: z.record(z.string(), segmentSchema),
  receipts: z.record(
    z.string(),
    z.object({
      expiresAt: z.number(),
      day: z.string(),
      segment: z.enum(["real", "synthetic"]),
      outcome: outcomeSchema.optional(),
    }),
  ),
});
type Ledger = z.infer<typeof ledgerSchema>;
const emptyCounts = () => ({
  corrected_files: 0,
  corrections: 0,
  YES: 0,
  NO: 0,
  NOT_YET: 0,
});
export function usagePath() {
  return process.env.USAGE_LOG_PATH || ".feedfix-metrics/usage.json";
}

// Caller serializes mutations with the same single-process lock as analysis state.
export class UsageLog {
  constructor(readonly path = usagePath()) {}
  async read(): Promise<Ledger> {
    try {
      return ledgerSchema.parse(JSON.parse(await readFile(this.path, "utf8")));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return { version: 1, days: {}, receipts: {} };
      throw e;
    }
  }
  private prune(ledger: Ledger) {
    for (const [key, receipt] of Object.entries(ledger.receipts))
      if (receipt.expiresAt <= Date.now()) delete ledger.receipts[key];
  }
  private key(id: string) {
    return createHash("sha256")
      .update("feedfix-usage:" + id)
      .digest("hex");
  }
  private async write(ledger: Ledger) {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary =
      this.path + "." + randomBytes(12).toString("hex") + ".tmp";
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(ledger));
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      await rename(temporary, this.path);
    } finally {
      await unlink(temporary).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    }
  }
  async corrected(
    record: { id: string; expiresAt: number; synthetic: boolean },
    corrections: number,
  ) {
    if (corrections <= 0 || record.expiresAt <= Date.now()) return false;
    const ledger = await this.read();
    this.prune(ledger);
    const key = this.key(record.id);
    if (ledger.receipts[key]) return false;
    const day = new Date().toISOString().slice(0, 10),
      segment = record.synthetic ? "synthetic" : "real";
    ledger.days[day] ??= { real: emptyCounts(), synthetic: emptyCounts() };
    ledger.days[day][segment].corrected_files++;
    ledger.days[day][segment].corrections += corrections;
    ledger.receipts[key] = { expiresAt: record.expiresAt, day, segment };
    await this.write(ledger);
    return true;
  }
  async feedback(id: string, outcome: Outcome) {
    const ledger = await this.read();
    this.prune(ledger);
    const receipt = ledger.receipts[this.key(id)];
    if (!receipt)
      throw new Error("Download the corrected file before sending feedback.");
    const counts = ledger.days[receipt.day][receipt.segment];
    if (receipt.outcome) counts[receipt.outcome]--;
    counts[outcome]++;
    receipt.outcome = outcome;
    await this.write(ledger);
  }
  async cleanup() {
    const ledger = await this.read();
    const before = Object.keys(ledger.receipts).length;
    this.prune(ledger);
    if (Object.keys(ledger.receipts).length !== before)
      await this.write(ledger);
  }
  async summary() {
    const { days } = await this.read();
    const totals = { real: emptyCounts(), synthetic: emptyCounts() };
    for (const day of Object.values(days))
      for (const segment of ["real", "synthetic"] as const)
        for (const key of Object.keys(totals[segment]) as (keyof ReturnType<
          typeof emptyCounts
        >)[])
          totals[segment][key] += day[segment][key];
    return {
      definition:
        "One successfully generated corrected XLSX per analysis, not Walmart acceptance or confirmed receipt by the browser.",
      timezone: "UTC",
      totals,
      days,
    };
  }
}
