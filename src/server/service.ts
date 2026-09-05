import { getSchema } from "../engine/schema";
import { parseWorkbook } from "../engine/workbook";
import { validateWorkbook } from "../engine/validate";
import {
  buildFixPlan,
  applyApprovedAutomaticFixes,
  generateReport,
} from "../engine/fix";
import { correlate, processingReportParser } from "../engine/processing-report";
import { config } from "./config";
import { authorize, store, opaque, tokenHash, type Analysis } from "./store";
import { UsageLog, type Outcome } from "./usage";
import { track } from "./analytics";
export function publicAnalysis(a: Analysis) {
  return {
    id: a.id,
    status: a.status,
    expiresAt: a.expiresAt,
    itemCount: a.itemCount,
    sheetCount: a.sheetCount,
    synthetic: a.synthetic,
    amount: a.amount,
    autoFixCount: a.plan.length,
    issues: a.issues,
    changes: a.plan,
    generated: Boolean(a.generated),
    feedback: a.feedback,
  };
}
export async function analyze(
  original: Buffer,
  report?: { buffer: Buffer; extension: "csv" | "xlsx" },
) {
  const start = Date.now();
  track("analysis_started");
  const schema = getSchema(),
    workbook = parseWorkbook(original);
  const result = validateWorkbook(workbook, schema);
  const issues = report
    ? correlate(
        result.issues,
        processingReportParser.parse(report.buffer, report.extension, schema),
        workbook,
        schema,
      )
    : result.issues;
  const plan = buildFixPlan(issues),
    id = opaque(),
    token = opaque();
  // Prove generation is possible before offering a free download. This output is discarded.
  if (plan.length) applyApprovedAutomaticFixes(workbook, plan);
  const record: Analysis = {
    id,
    tokenHash: tokenHash(token),
    createdAt: Date.now(),
    expiresAt: Date.now() + config().ttl * 60000,
    original: original.toString("base64"),
    issues,
    plan,
    itemCount: result.itemCount,
    sheetCount: workbook.sheets.length,
    synthetic: schema.synthetic,
    status: "ANALYZED",
    amount: config().amount,
  };
  await store.capacity(Buffer.byteLength(JSON.stringify(record)));
  await store.put(record);
  const counts = {
    issue_count: issues.length,
    auto_fix_count: plan.length,
    needs_input_count: issues.filter((i) => i.resolution === "NEEDS_USER_INPUT")
      .length,
    walmart_support_count: issues.filter(
      (i) => i.resolution === "WALMART_SUPPORT",
    ).length,
    sheet_count: workbook.sheets.length,
    processing_duration_ms: Date.now() - start,
  };
  track("analysis_completed", counts);
  track(issues.length ? "issues_found" : "no_issues_found", counts);
  return { token, analysis: publicAnalysis(record) };
}
export async function download(id: string, token: string, report = false) {
  const record = await authorize(id, token);
  if (!record.plan.length && !report)
    throw new Error("No automatic corrections are available for this file.");
  const content = report
    ? Buffer.from(generateReport(record.plan, record.issues))
    : applyApprovedAutomaticFixes(
        parseWorkbook(Buffer.from(record.original, "base64")),
        record.plan,
      );
  if (!report) {
    // The durable receipt makes retries safe even if the process stops before store.put.
    try {
      const first = await new UsageLog().corrected(record, record.plan.length);
      if (first)
        track("corrected_file_generated", {
          auto_fix_count: record.plan.length,
        });
    } catch {
      console.warn(JSON.stringify({ event: "correction_log_write_failed" }));
    }
    if (!record.generated) {
      record.generated = true;
      await store.put(record);
    }
  }
  if (!report) track("corrected_file_downloaded");
  return content;
}

export async function feedback(id: string, token: string, outcome: Outcome) {
  const record = await authorize(id, token);
  if (!record.generated)
    throw new Error("Download the corrected file before sending feedback.");
  await new UsageLog().feedback(id, outcome);
  record.feedback = outcome;
  await store.put(record);
  return publicAnalysis(record);
}
