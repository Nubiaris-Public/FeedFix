import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import {
  evidenceOrigin,
  marketplaceSchema,
  type FeedIssue,
} from "../../src/engine/model";
import { fixtureSchema } from "../../src/engine/schema";
import { hydrateOfficialFields } from "../../src/engine/compiled-runtime";
import { parseWorkbook } from "../../src/engine/workbook";
import { validateWorkbook } from "../../src/engine/validate";
import {
  applyApprovedAutomaticFixes,
  buildFixPlan,
} from "../../src/engine/fix";
import { verifyWorkbookIntegrity } from "../../src/engine/integrity";
import { digest, readBoundedJson } from "../../src/engine/compiled-graph";
import { mappingHash, schemaOrigin } from "../../src/engine/evidence";
const finding = z
  .object({ code: z.string(), cell: z.string().optional() })
  .strict();
const metadataSchema = z
  .object({
    origin: evidenceOrigin,
    schemaVersion: z.string(),
    workbook: z.string(),
    mapping: z.string().optional(),
    fixtureSha256: z.string().regex(/^[a-f0-9]{64}$/),
    expectedErrors: z.array(finding),
    expectedRemainingErrors: z.array(finding),
    expectedRepairs: z.array(
      z
        .object({ cell: z.string(), before: z.unknown(), after: z.unknown() })
        .strict(),
    ),
    allowedStructuralChanges: z.array(
      z.object({ sheet: z.string(), cell: z.string() }).strict(),
    ),
    reviewedBy: z.string().optional(),
    provenance: z.string().min(1),
  })
  .strict();
const sorted = (values: unknown[]) =>
  values.map((v) => JSON.stringify(v)).sort();
const assertEqual = (actual: unknown[], expected: unknown[], label: string) => {
  if (JSON.stringify(sorted(actual)) !== JSON.stringify(sorted(expected)))
    throw new Error(`Golden ${label} mismatch: ${JSON.stringify(actual)}`);
};
const summarize = (issues: FeedIssue[]) =>
  issues.map((i) => ({ code: i.code, ...(i.cell ? { cell: i.cell } : {}) }));
export function runGolden(metadataFile: string) {
  const metadata = metadataSchema.parse(readBoundedJson(metadataFile));
  const input = readFileSync(resolve(dirname(metadataFile), metadata.workbook));
  if (digest(input) !== metadata.fixtureSha256)
    throw new Error("Golden fixture hash mismatch");
  let schema = metadata.mapping
    ? marketplaceSchema.parse(
        readBoundedJson(resolve(dirname(metadataFile), metadata.mapping)),
      )
    : structuredClone(fixtureSchema);
  if (schema.compiled) schema = hydrateOfficialFields(schema);
  if (
    schemaOrigin(schema) !== metadata.origin ||
    schema.version !== metadata.schemaVersion
  )
    throw new Error(
      "Golden provenance mismatch; origin cannot be promoted by a test",
    );
  if (
    metadata.origin === "WALMART_CURRENT_SUPPORTED" &&
    (!schema.compiled ||
      !metadata.reviewedBy?.trim() ||
      /synthetic/i.test(schema.marker.value))
  )
    throw new Error(
      "Golden current evidence requires explicit review of a real current workbook",
    );
  const workbook = parseWorkbook(input);
  const result = validateWorkbook(workbook, schema);
  assertEqual(summarize(result.issues), metadata.expectedErrors, "findings");
  const plan = buildFixPlan(result.issues);
  assertEqual(
    plan.map((p) => ({ cell: p.cell, before: p.before, after: p.after })),
    metadata.expectedRepairs,
    "repairs",
  );
  assertEqual(
    plan.map((p) => ({ sheet: p.sheet, cell: p.cell })),
    metadata.allowedStructuralChanges,
    "allowed structural changes",
  );
  const output = applyApprovedAutomaticFixes(workbook, plan);
  const repaired = validateWorkbook(parseWorkbook(output), schema);
  assertEqual(
    summarize(repaired.issues),
    metadata.expectedRemainingErrors,
    "remaining findings",
  );
  const integrity = verifyWorkbookIntegrity(input, output, plan);
  const twice = applyApprovedAutomaticFixes(
    parseWorkbook(output),
    buildFixPlan(repaired.issues),
  );
  if (!output.equals(twice)) throw new Error("Golden byte idempotency failed");
  return {
    format: "feedfix-golden-v1",
    status: "PASS",
    origin: metadata.origin,
    schemaVersion: schema.version,
    schemaSha256: schema.compiled?.sourceSha256,
    mappingSha256: mappingHash(schema),
    fixtureSha256: metadata.fixtureSha256,
    reviewedBy: metadata.reviewedBy,
    findings: result.issues.length,
    repairs: plan.length,
    remaining: repaired.issues.length,
    integrity,
  };
}
export function goldenFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? goldenFiles(join(directory, e.name))
      : e.name.endsWith(".golden.json")
        ? [join(directory, e.name)]
        : [],
  );
}
export function writeGolden(
  file: string,
  result: ReturnType<typeof runGolden>,
) {
  writeFileSync(file, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
}
