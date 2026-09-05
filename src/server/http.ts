import { parseWorkbook, InvalidWorkbookError } from "../engine/workbook";
import {
  LocalTemplateNotifications,
  notificationInput,
} from "./template-notifications";
import { inspectUpload } from "./service";
import { CONTRIBUTION_CONSENT_VERSION } from "../shared/contribution-consent";
import { ContributionStore } from "./contributions";
import type { ContributionReceipt } from "../shared/contribution-consent";
import { outcomeSchema } from "./usage";
import { config } from "./config";
import { analyze, download, publicAnalysis, feedback } from "./service";
import { authorize, exclusive, startCleanup } from "./store";
import { checkout, mockPayment, webhook } from "./payment";
import { events, track } from "./analytics";
let uploadsInFlight = 0;
const rates = new Map<string, { count: number; until: number }>();
function rateLimit(request: Request, scope = "general", limit = 90) {
  const header = process.env.TRUSTED_IP_HEADER;
  const ip = header
    ? (request.headers.get(header) ?? "shared").split(",")[0].trim()
    : "shared";
  const rateKey = scope + ":" + ip;
  const now = Date.now();
  for (const [key, v] of rates) if (v.until < now) rates.delete(key);
  if (rates.size > 10000 && !rates.has(rateKey))
    throw new Error("Too many requests. Please wait a minute.");
  const value = rates.get(rateKey) ?? { count: 0, until: now + 60000 };
  value.count++;
  rates.set(rateKey, value);
  if (value.count > limit)
    throw new Error("Too many requests. Please wait a minute.");
}
export async function boundedBody(request: Request, max: number) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > max)
    throw new Error("This file is too large. Choose a smaller file.");
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new Error("This file is too large. Choose a smaller file.");
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}
function fileCheck(file: File, report = false) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!file.size || file.size > config().maxUpload * 1024 * 1024)
    throw new InvalidWorkbookError(
      `Choose a non-empty file under ${config().maxUpload} MB.`,
    );
  const allowed = report ? ["xlsx", "csv"] : ["xlsx"];
  if (!extension || !allowed.includes(extension))
    throw new InvalidWorkbookError(
      report
        ? "Choose an XLSX or CSV processing report."
        : "Choose an XLSX workbook. XLS and XLSM are not supported.",
    );
  const mimes =
    extension === "csv"
      ? [
          "text/csv",
          "application/csv",
          "text/plain",
          "application/vnd.ms-excel",
          "",
        ]
      : [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/octet-stream",
          "",
        ];
  if (!mimes.includes(file.type))
    throw new InvalidWorkbookError(
      "File type does not match an allowed spreadsheet.",
    );
  return extension as "csv" | "xlsx";
}
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function handle(request: Request) {
  startCleanup();
  let contribution: ContributionReceipt | undefined;
  const url = new URL(request.url),
    parts = url.pathname.replace(/^\/api\/?/, "").split("/"),
    action = parts[0],
    id = parts[1] ?? "",
    token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  try {
    if (action === "webhook" && request.method === "POST") {
      const body = await boundedBody(request, 1024 * 1024);
      await exclusive(() =>
        webhook(
          body.toString("utf8"),
          request.headers.get("stripe-signature") ?? "",
        ),
      );
      return json({ received: true });
    }
    rateLimit(request);
    if (
      request.method === "POST" &&
      request.headers.get("origin") !== new URL(config().appUrl).origin
    )
      return json(
        {
          error:
            "This request must come from FeedFix. Reload the page and retry.",
        },
        403,
      );
    if (action === "template-notification" && request.method === "POST") {
      rateLimit(request, "notification", 10);
      const parsed = notificationInput.safeParse(
        JSON.parse((await boundedBody(request, 1024)).toString()),
      );
      if (!parsed.success)
        return json(
          {
            error:
              "Enter a valid email and accept the notification privacy terms.",
          },
          400,
        );
      const result = await exclusive(async () => {
        const template = await new ContributionStore().notificationTemplate(
          parsed.data.studyId,
          parsed.data.deleteToken,
        );
        return new LocalTemplateNotifications().request(parsed.data, template);
      });
      track("template_notification_requested");
      return json(result, 201);
    }
    if (action === "notification-delete" && request.method === "POST") {
      const data = JSON.parse((await boundedBody(request, 512)).toString());
      if (typeof data.deleteToken !== "string")
        return json({ error: "This deletion link is invalid." }, 400);
      await exclusive(() =>
        new LocalTemplateNotifications().delete(id, data.deleteToken),
      );
      return json({ deleted: true });
    }
    if (action === "contribution" && request.method === "POST") {
      const data = JSON.parse((await boundedBody(request, 512)).toString());
      if (typeof data.deleteToken !== "string")
        throw new Error("This study deletion link is invalid.");
      await exclusive(() =>
        new ContributionStore().delete(id, data.deleteToken),
      );
      return json({ deleted: true });
    }
    if (action === "events" && request.method === "POST") {
      const data = JSON.parse((await boundedBody(request, 2048)).toString());
      if (
        events.includes(data.event) &&
        ["landing_view", "file_selected", "template_share_declined"].includes(
          data.event,
        )
      )
        track(data.event, data.properties ?? {});
      return json({ ok: true });
    }
    if (
      ["analyze", "study-share"].includes(action) &&
      request.method === "POST"
    ) {
      if (uploadsInFlight >= 2)
        throw new Error("FeedFix is busy. Please retry in a moment.");
      uploadsInFlight++;
      try {
        const body = await boundedBody(
          request,
          config().maxUpload * 1024 * 1024 * 2 + 65536,
        );
        const form = await new Request(request.url, {
          method: "POST",
          headers: {
            "Content-Type": request.headers.get("content-type") ?? "",
          },
          body: new Uint8Array(body),
        }).formData();
        const file = form.get("file"),
          report = form.get("report");
        if (!(file instanceof File))
          throw new Error("Choose the original XLSX workbook first.");
        fileCheck(file);
        let reportData:
          { buffer: Buffer; extension: "csv" | "xlsx" } | undefined;
        if (report instanceof File && report.size) {
          const extension = fileCheck(report, true);
          reportData = {
            buffer: Buffer.from(await report.arrayBuffer()),
            extension,
          };
        }
        if (reportData?.extension === "xlsx") parseWorkbook(reportData.buffer);
        track("upload_completed", {
          file_size_bucket:
            file.size < 1024 * 1024
              ? "small"
              : file.size < 10 * 1024 * 1024
                ? "medium"
                : "large",
        });
        const original = Buffer.from(await file.arrayBuffer());
        return json(
          await exclusive(async () => {
            const version = form.get("studyConsent");
            const result =
              action === "study-share"
                ? inspectUpload(original).unsupported
                : await analyze(original, reportData);
            if (
              action === "study-share" &&
              (result?.status !== "NEW_WALMART_TEMPLATE" ||
                version !== CONTRIBUTION_CONSENT_VERSION)
            )
              throw new Error(
                "Choose a new Walmart template and explicitly agree to share it.",
              );
            try {
              contribution = await new ContributionStore().save(
                original,
                typeof version === "string" ? version : undefined,
              );
            } catch {
              contribution = { status: "unavailable" };
              console.warn(JSON.stringify({ event: "study_copy_unavailable" }));
            }
            if (
              result?.status === "NEW_WALMART_TEMPLATE" &&
              contribution.status === "saved"
            )
              track("template_share_accepted");
            return { ...result, contribution };
          }),
        );
      } finally {
        uploadsInFlight--;
      }
    }
    if (action === "analysis" && request.method === "GET")
      return json(publicAnalysis(await exclusive(() => authorize(id, token))));
    if (action === "feedback" && request.method === "POST") {
      const { outcome } = JSON.parse(
        (await boundedBody(request, 256)).toString(),
      );
      const parsed = outcomeSchema.safeParse(outcome);
      if (!parsed.success)
        return json({ error: "Choose Yes, No or Haven’t tried yet." }, 400);
      return json(await exclusive(() => feedback(id, token, parsed.data)));
    }
    if (action === "checkout" && request.method === "POST")
      return json(await exclusive(() => checkout(id, token)));
    if (
      action === "mock-payment" &&
      request.method === "POST" &&
      config().mock
    ) {
      await exclusive(() => mockPayment(id, token));
      return json({ ok: true });
    }
    if (action === "download" && request.method === "GET") {
      const report = url.searchParams.get("report") === "1";
      const buffer = await exclusive(() => download(id, token, report));
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": report
            ? "application/json"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${report ? "feedfix-changes.json" : "feedfix-corrected.xlsx"}"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return json(
      { error: "This link is unavailable. Return to your analysis." },
      404,
    );
  } catch (error) {
    if (action === "analyze") track("analysis_failed");
    if (action === "webhook")
      return json(
        { error: "Webhook could not be verified or fulfilled." },
        400,
      );
    if (["template-notification", "notification-delete"].includes(action))
      return json(
        {
          error: /Too many/.test(error instanceof Error ? error.message : "")
            ? "Too many requests. Please wait a minute."
            : "We could not save or update this notification request. Check the address and that your study copy has not expired.",
        },
        /Too many/.test(error instanceof Error ? error.message : "")
          ? 429
          : 400,
      );
    const message = error instanceof Error ? error.message : "";
    const safe =
      /^(Download |Thank you |This |Choose |Upload |No |Too |FeedFix |Complete |Synthetic |Checkout |Test payments |Start checkout |There are |Processing |Invalid |Duplicate |Report |Workbook |File type |Macros|External |The |We couldn't|Fix precondition)/.test(
        message,
      );
    return json(
      {
        ...(contribution ? { contribution } : {}),
        ...(["analyze", "study-share"].includes(action)
          ? {
              status:
                error instanceof InvalidWorkbookError
                  ? "INVALID_OR_UNSAFE_FILE"
                  : "REQUEST_FAILED",
            }
          : {}),
        error: safe
          ? message
          : "We couldn't process this file. Make sure you're uploading the original supported XLSX workbook and try again.",
      },
      /Too many/.test(message) ? 429 : 400,
    );
  }
}
