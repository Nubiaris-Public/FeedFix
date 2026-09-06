import { entries } from "../decoder/knowledge";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export const events = [
  "error_decoder_viewed",
  "error_decoder_submitted",
  "error_decoder_documented_match",
  "error_decoder_likely_match",
  "error_decoder_unknown",
  "error_decoder_workbook_cta",
  "error_decoder_unknown_share_offered",
  "error_decoder_unknown_share_accepted",
  "error_decoder_unknown_share_declined",
  "landing_view",
  "file_selected",
  "upload_completed",
  "analysis_started",
  "analysis_completed",
  "issues_found",
  "no_issues_found",
  "checkout_started",
  "payment_completed",
  "corrected_file_generated",
  "corrected_file_downloaded",
  "analysis_failed",
  "new_template_detected",
  "unknown_spreadsheet_detected",
  "template_share_offered",
  "template_share_accepted",
  "template_share_declined",
  "template_notification_requested",
] as const;
export type AnalyticsEvent = (typeof events)[number];
export interface Analytics {
  track(
    event: AnalyticsEvent,
    properties: Record<string, number | string>,
  ): void | Promise<void>;
}
const allowed = new Set([
  "issue_count",
  "auto_fix_count",
  "needs_input_count",
  "walmart_support_count",
  "processing_duration_ms",
  "file_size_bucket",
  "sheet_count",
]);
type EntryPoint = "browser_event" | "analyze" | "study_share" | "api";
const context = new AsyncLocalStorage<{
  requestId: string;
  entryPoint: EntryPoint;
}>();
export function withAnalyticsRequest<T>(
  entryPoint: EntryPoint,
  operation: () => T,
): T {
  return context.run({ requestId: randomUUID(), entryPoint }, operation);
}

let adapter: Analytics = {
  track: (event, properties) => {
    const activity = event === "landing_view" || event === "upload_completed";
    const enabled = activity
      ? process.env.CONSOLE_ACTIVITY_ENABLED !== "false"
      : process.env.ANALYTICS_ENABLED === "true";
    if (enabled)
      console.info(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          ...(context.getStore() ?? {
            requestId: randomUUID(),
            entryPoint: "internal",
          }),
          event,
          properties,
        }),
      );
  },
};
export function setAnalytics(next: Analytics) {
  adapter = next;
}
export function track(
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {},
) {
  const safe: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(properties))
    if (
      allowed.has(key) &&
      ((typeof value === "number" && Number.isFinite(value)) ||
        (key === "file_size_bucket" &&
          ["small", "medium", "large"].includes(String(value))))
    )
      safe[key] = value as string | number;
  if (event.startsWith("error_decoder_")) {
    for (const key of Object.keys(safe)) delete safe[key];
    const entry = entries.find((e) => e.entryId === properties.entry_id);
    if (entry) {
      safe.entry_id = entry.entryId;
      safe.error_family = entry.family;
      if (
        ["DOCUMENTED", "LIKELY_MATCH", "UNKNOWN"].includes(
          String(properties.confidence),
        )
      )
        safe.confidence = String(properties.confidence);
    }
  }
  try {
    Promise.resolve(adapter.track(event, safe)).catch(() => {});
  } catch {
    /* Analytics must never affect fulfillment. */
  }
}
