import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { UsageLog } from "../src/server/usage";
let directory: string;
let log: UsageLog;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "feedfix-usage-"));
  log = new UsageLog(join(directory, "usage.json"));
});
afterEach(async () => {
  vi.useRealTimers();
  await rm(directory, { recursive: true, force: true });
});
it("counts once per analysis, separates synthetic traffic and survives restarts", async () => {
  const record = {
    id: "opaque-id",
    expiresAt: Date.now() + 60000,
    synthetic: false,
  };
  expect(await log.corrected(record, 2)).toBe(true);
  expect(await log.corrected(record, 2)).toBe(false);
  const restarted = new UsageLog(log.path);
  expect(await restarted.corrected(record, 2)).toBe(false);
  await restarted.corrected({ ...record, id: "fixture", synthetic: true }, 4);
  const summary = await restarted.summary();
  expect(summary.totals.real.corrected_files).toBe(1);
  expect(summary.totals.synthetic.corrected_files).toBe(1);
  expect(summary.totals.real.corrections).toBe(2);
  expect(await readFile(log.path, "utf8")).not.toContain("opaque-id");
});
it("does not count zero fixes or expired analyses", async () => {
  expect(
    await log.corrected(
      { id: "zero", expiresAt: Date.now() + 60000, synthetic: false },
      0,
    ),
  ).toBe(false);
  expect(
    await log.corrected(
      { id: "expired", expiresAt: Date.now() - 1, synthetic: false },
      2,
    ),
  ).toBe(false);
  expect((await log.summary()).totals.real.corrected_files).toBe(0);
});
it("keeps anonymous daily totals after receipts expire and deletes temporary correlation", async () => {
  vi.useFakeTimers();
  const now = Date.now();
  await log.corrected(
    { id: "once", expiresAt: now + 1000, synthetic: false },
    3,
  );
  await log.feedback("once", "NOT_YET");
  await log.feedback("once", "YES");
  await log.feedback("once", "YES");
  expect((await log.summary()).totals.real).toEqual({
    corrected_files: 1,
    corrections: 3,
    YES: 1,
    NO: 0,
    NOT_YET: 0,
  });
  vi.setSystemTime(now + 2000);
  await log.cleanup();
  expect((await log.read()).receipts).toEqual({});
  expect((await log.summary()).totals.real.corrected_files).toBe(1);
  await expect(log.feedback("once", "NO")).rejects.toThrow(/Download/);
});
