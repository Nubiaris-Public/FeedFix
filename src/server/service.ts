import { supportEvidence } from "../engine/evidence";
import { getSchema } from "../engine/schema";
import { parseWorkbook } from "../engine/workbook";
import type { UnsupportedUpload } from "../shared/upload-result";
import { identifyWalmartWorkbook } from "../engine/identify-workbook";
import {
  matchTemplate,
  UnsupportedTemplateError,
  validateWorkbook,
} from "../engine/validate";
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
    origin: a.origin ?? (a.synthetic ? "SYNTHETIC" : "UNKNOWN"),
    paidSupportEligible: a.paidSupportEligible === true,
    schemaVersion: a.schemaSnapshot?.version,
    schemaSha256: a.schemaSha256,
    validationScope: a.schemaSnapshot?.compiled
      ? "COMPILED_OFFICIAL_SCHEMA"
      : "SYNTHETIC_RULES",
    amount: a.amount,
    autoFixCount: a.plan.length,
    issues: a.issues,
    changes: a.plan,
    generated: Boolean(a.generated),
    feedback: a.feedback,
  };
}
export function inspectUpload(original: Buffer) {
  const workbook = parseWorkbook(original);
  const schema =
    !process.env.SCHEMA_PATH &&
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_SYNTHETIC_FIXTURES !== "true"
      ? undefined
      : getSchema();
  if (schema) {
    try {
      matchTemplate(workbook, schema);
      return { workbook, schema, unsupported: null };
    } catch (error) {
      if (!(error instanceof UnsupportedTemplateError)) throw error;
    }
  }
  const walmartDetected = Boolean(identifyWalmartWorkbook(workbook));
  const unsupported: UnsupportedUpload = {
    status: walmartDetected ? "NEW_WALMART_TEMPLATE" : "UNKNOWN_SPREADSHEET",
    walmartDetected,
    supported: false,
    modified: false,
    studyShareAvailable: walmartDetected,
    checkoutAvailable: false,
  };
  return { workbook, schema: undefined, unsupported };
}
export async function analyze(
  original: Buffer,
  report?: { buffer: Buffer; extension: "csv" | "xlsx" },
) {
  const start = Date.now();
  track("analysis_started");
  const { schema, workbook, unsupported } = inspectUpload(original);
  if (unsupported) {
    track(
      unsupported.walmartDetected
        ? "new_template_detected"
        : "unknown_spreadsheet_detected",
    );
    if (unsupported.studyShareAvailable) track("template_share_offered");
    return unsupported;
  }
  if (!schema) throw Error("Missing configured schema");
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
  const repaired = plan.length
    ? applyApprovedAutomaticFixes(workbook, plan)
    : original;
  const revalidated = validateWorkbook(parseWorkbook(repaired), schema);
  if (plan.length && buildFixPlan(revalidated.issues).length)
    throw new Error("This repair did not reach an idempotent result.");
  const remainingIssues = [
    ...revalidated.issues,
    ...issues.filter(
      (i) =>
        i.source === "WALMART" ||
        (i.source === "BOTH" && i.resolution === "WALMART_SUPPORT"),
    ),
  ];
  const evidence = supportEvidence(schema);
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
    ...evidence,
    schemaSnapshot: schema,
    remainingIssues,
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
  track("analysis_completed", {
    ...counts,
    workbook_kind: schema.synthetic ? "synthetic" : "real",
    support_verified: evidence.paidSupportEligible ? 1 : 0,
  });
  track(issues.length ? "issues_found" : "no_issues_found", counts);
  return {
    status: "SUPPORTED" as const,
    token,
    analysis: publicAnalysis(record),
  };
}
export async function download(id: string, token: string, report = false) {
  const record = await authorize(id, token);
  if (!record.plan.length && !report)
    throw new Error("No automatic corrections are available for this file.");
  const content = report
    ? Buffer.from(
        generateReport(record.plan, record.remainingIssues ?? record.issues),
      )
    : applyApprovedAutomaticFixes(
        parseWorkbook(Buffer.from(record.original, "base64")),
        record.plan,
      );
  if (!report) {
    const revalidated = validateWorkbook(
      parseWorkbook(content),
      record.schemaSnapshot ?? getSchema(),
    );
    if (buildFixPlan(revalidated.issues).length)
      throw new Error("This repaired workbook failed revalidation.");
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
  if (!report)
    track("corrected_file_downloaded", {
      workbook_kind: record.synthetic ? "synthetic" : "real",
    });
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
