import { lstat, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { runStudyProbes } from "./study-probes";
import { z } from "zod";
import type { studyWorkbook } from "./workbook-study";

const actions = {
  unknownLayout:
    "Add synthetic coverage for unrecognized workbook layouts; review a temporary study before designing an adapter.",
  candidateLayout:
    "Review MP_ITEM header mapping against the compiled schema and add synthetic adapter tests.",
  hiddenSheets: "Verify hidden-sheet preservation in synthetic repair tests.",
  formulas:
    "Verify formula preservation and ambiguous-cell handling in synthetic repair tests.",
  validations: "Verify data-validation preservation in synthetic repair tests.",
  merges: "Verify merged-range preservation in synthetic repair tests.",
  tables: "Verify table relationships in synthetic repair tests.",
  definedNames: "Verify defined-name preservation in synthetic repair tests.",
  truncatedColumns:
    "Review bounded column inspection using a wide synthetic workbook.",
};
const counter = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const counters = z
  .object({
    unknownLayout: counter,
    candidateLayout: counter,
    hiddenSheets: counter,
    formulas: counter,
    validations: counter,
    merges: counter,
    tables: counter,
    definedNames: counter,
    truncatedColumns: counter,
  })
  .strict();
const schema = z
  .object({ version: z.literal(1), uploads: counter, signals: counters })
  .strict();
const empty = () =>
  schema.parse({
    version: 1,
    uploads: 0,
    signals: Object.fromEntries(Object.keys(actions).map((k) => [k, 0])),
  });
async function read(root: string) {
  const path = join(root, "feedback.json");
  const info = await lstat(path).catch((e) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (!info) return empty();
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16384)
    throw Error("Invalid feedback storage");
  return schema.parse(JSON.parse(await readFile(path, "utf8")));
}
/** Called only for newly accepted v2 consent, inside the single-instance mutation queue.
 * Only fixed-vocabulary aggregate counters cross the temporary/permanent boundary.
 */
export async function recordStudyFeedback(
  root: string,
  report: ReturnType<typeof studyWorkbook>,
) {
  const data = await read(root);
  const any = (
    key: "formulas" | "dataValidations" | "mergedRanges" | "tables",
  ) => report.sheets.some((s) => s[key] > 0);
  const flags = {
    unknownLayout: !report.sheets.some(
      (s) => s.layout === "WALMART_MP_ITEM_CANDIDATE",
    ),
    candidateLayout: report.sheets.some(
      (s) => s.layout === "WALMART_MP_ITEM_CANDIDATE",
    ),
    hiddenSheets: report.sheets.some((s) => s.visibility !== "visible"),
    formulas: any("formulas"),
    validations: any("dataValidations"),
    merges: any("mergedRanges"),
    tables: any("tables"),
    definedNames: report.definedNames > 0,
    truncatedColumns: report.sheets.some((s) => s.columnsTruncated),
  };
  data.uploads = Math.min(Number.MAX_SAFE_INTEGER, data.uploads + 1);
  for (const key of Object.keys(flags) as (keyof typeof flags)[]) {
    if (flags[key])
      data.signals[key] = Math.min(
        Number.MAX_SAFE_INTEGER,
        data.signals[key] + 1,
      );
  }
  // Fixed file, atomic replacement; no IDs, dates, hashes, labels or cell content.
  const pending = join(root, "feedback.pending.json");
  await unlink(pending).catch((e) => {
    if (e.code !== "ENOENT") throw e;
  });
  await writeFile(pending, JSON.stringify(schema.parse(data), null, 2) + "\n", {
    mode: 0o600,
    flag: "wx",
  });
  await rename(pending, join(root, "feedback.json"));
  const checks = runStudyProbes(data.signals);
  const checksPending = join(root, "synthetic-checks.pending.json");
  await unlink(checksPending).catch((e) => {
    if (e.code !== "ENOENT") throw e;
  });
  await writeFile(
    checksPending,
    JSON.stringify(
      { probeVersion: "1", evidence: "SYNTHETIC", checks },
      null,
      2,
    ) + "\n",
    { mode: 0o600, flag: "wx" },
  );
  await rename(checksPending, join(root, "synthetic-checks.json"));
  if (checks.some((c) => c.status === "FAIL"))
    console.error("study_synthetic_probe_failed");
}
export async function studyFeedback(root: string) {
  const data = await read(root);
  // Re-run on the installed code; old stored PASS results are never trusted.
  const checks = runStudyProbes(data.signals);
  return {
    ...data,
    checks,
    probeVersion: "1",
    uncovered: Object.keys(data.signals).filter(
      (key) =>
        data.signals[key as keyof typeof data.signals] > 0 &&
        !checks.some((c) => c.feature === key),
    ),
    evidence: "UNVERIFIED_UPLOAD_AGGREGATES",
    enablesSupportOrPayments: false,
    proposals: (Object.keys(actions) as (keyof typeof actions)[])
      .filter((key) => data.signals[key] > 0)
      .sort(
        (a, b) =>
          Number(checks.some((c) => c.feature === b && c.status === "FAIL")) -
            Number(
              checks.some((c) => c.feature === a && c.status === "FAIL"),
            ) ||
          data.signals[b] - data.signals[a] ||
          a.localeCompare(b),
      )
      .map((key) => ({
        code: key,
        observedUploads: data.signals[key],
        status: "REVIEW_REQUIRED",
        syntheticCheck: checks.find((c) => c.feature === key) || {
          status: "NOT_COVERED",
        },
        acceptanceCriteria: [
          "Add or update an independent synthetic regression case.",
          "Pass validation, safe repair, revalidation, structural integrity and idempotency.",
          "Require reviewed current Walmart evidence separately before enabling support.",
        ],
        reproduce: checks.some((c) => c.feature === key)
          ? "node study-uploads.cjs probe " + key
          : null,
        action: actions[key],
      })),
  };
}
