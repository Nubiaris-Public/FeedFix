import { it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { goldenFiles, runGolden } from "../tools/walmart-schema/golden";
import { fixtureSchema, getSchema } from "../src/engine/schema";
import { supportEvidence, mappingHash } from "../src/engine/evidence";
import type { EvidenceOrigin } from "../src/engine/model";
import { validateWorkbook } from "../src/engine/validate";
import { parseWorkbook } from "../src/engine/workbook";
afterEach(() => vi.unstubAllEnvs());
it.each(goldenFiles("tests/fixtures/walmart"))("golden %s", (file) => {
  const result = runGolden(file);
  expect(result.status).toBe("PASS");
  expect(result.origin).toBe("SYNTHETIC");
});
it.each([
  "SYNTHETIC",
  "WALMART_LEGACY_REAL",
  "UNKNOWN",
  "WALMART_CURRENT_SUPPORTED",
] as EvidenceOrigin[])(
  "%s cannot claim current workbook support without matching evidence",
  (origin) => {
    expect(
      supportEvidence({
        ...fixtureSchema,
        synthetic: origin === "SYNTHETIC",
        origin,
      }).paidSupportEligible,
    ).toBe(false);
  },
);
it("a passing synthetic golden report cannot become current support evidence", () => {
  vi.stubEnv(
    "SCHEMA_PATH",
    "tests/fixtures/walmart/synthetic/schema-27.mapping.json",
  );
  const schema = getSchema();
  const dir = mkdtempSync(join(tmpdir(), "feedfix-golden-"));
  const report = runGolden(
    "tests/fixtures/walmart/synthetic/schema-27.golden.json",
  );
  const evidence = join(dir, "evidence.json");
  writeFileSync(evidence, JSON.stringify(report));
  expect(
    supportEvidence({
      ...schema,
      synthetic: false,
      origin: "WALMART_CURRENT_SUPPORTED",
      goldenEvidencePath: evidence,
    }).paidSupportEligible,
  ).toBe(false);
});
it("production pipeline uses compiled assertions without claiming current workbook support", async () => {
  const directory = mkdtempSync(join(tmpdir(), "feedfix-official-http-"));
  vi.stubEnv(
    "SCHEMA_PATH",
    "tests/fixtures/walmart/synthetic/schema-27.mapping.json",
  );
  vi.stubEnv("TEMP_STORE_DIR", directory);
  vi.stubEnv("USAGE_LOG_PATH", join(directory, "metrics.json"));
  vi.stubEnv("PAYMENT_MODE", "stripe");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv("NODE_ENV", "production");
  const { analyze, download } = await import("../src/server/service");
  const { checkout } = await import("../src/server/payment");
  const result = await analyze(
    readFileSync("tests/fixtures/walmart/synthetic/schema-27.xlsx"),
  );
  if (result.status !== "SUPPORTED") throw Error("Expected supported fixture");
  expect(result.analysis.validationScope).toBe("COMPILED_OFFICIAL_SCHEMA");
  expect(result.analysis.schemaSha256).toHaveLength(64);
  expect(result.analysis.autoFixCount).toBe(1);
  expect(result.analysis.paidSupportEligible).toBe(false);
  const output = await download(result.analysis.id, result.token);
  expect(validateWorkbook(parseWorkbook(output), getSchema()).issues).toEqual(
    [],
  );
  await expect(checkout(result.analysis.id, result.token)).rejects.toThrow(
    /Checkout is not configured/,
  );
  const { store } = await import("../src/server/store");
  const record = await store.get(result.analysis.id);
  for (const origin of [
    "UNKNOWN",
    "WALMART_LEGACY_REAL",
    "WALMART_CURRENT_SUPPORTED",
  ] as EvidenceOrigin[]) {
    await store.put({ ...record!, synthetic: false, origin });
    await expect(checkout(result.analysis.id, result.token)).rejects.toThrow(
      /Checkout is not configured/,
    );
  }
  rmSync(directory, { recursive: true, force: true });
});
it("fixture metadata cannot promote a synthetic workbook by changing its origin", () => {
  const source = resolve(
    "tests/fixtures/walmart/synthetic/schema-27.golden.json",
  );
  const meta = JSON.parse(readFileSync(source, "utf8"));
  const directory = mkdtempSync(join(tmpdir(), "feedfix-promotion-"));
  meta.origin = "WALMART_CURRENT_SUPPORTED";
  meta.reviewedBy = "test";
  meta.workbook = resolve("tests/fixtures/walmart/synthetic/schema-27.xlsx");
  meta.mapping = resolve(
    "tests/fixtures/walmart/synthetic/schema-27.mapping.json",
  );
  const file = join(directory, "bad.golden.json");
  writeFileSync(file, JSON.stringify(meta));
  expect(() => runGolden(file)).toThrow(/provenance/);
});
it("mapping changes invalidate the evidence fingerprint", () => {
  expect(mappingHash({ ...fixtureSchema, headerRow: 3 })).not.toBe(
    mappingHash(fixtureSchema),
  );
});
