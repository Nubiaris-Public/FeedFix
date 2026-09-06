import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export const events = [
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
  try {
    Promise.resolve(adapter.track(event, safe)).catch(() => {});
  } catch {
    /* Analytics must never affect fulfillment. */
  }
}
