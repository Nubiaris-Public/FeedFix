import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AdmZip from "adm-zip";
import { newTemplateBytes } from "./helpers/new-template";
import {
  ContributionStore,
  CONTRIBUTION_CONSENT_VERSION,
} from "../src/server/contributions";
import { LocalTemplateNotifications } from "../src/server/template-notifications";
import { NOTIFICATION_CONSENT_VERSION } from "../src/shared/upload-result";
import { setAnalytics, track } from "../src/server/analytics";
import { identifyWalmartWorkbook } from "../src/engine/identify-workbook";
import { parseWorkbook } from "../src/engine/workbook";
let root: string, bytes: Buffer;
let handle: typeof import("../src/server/http").handle;
const events: Array<{ event: string; properties: Record<string, unknown> }> =
  [];
let sequence = 0;
const origin = "http://localhost:3000";
function request(path: string, body: BodyInit, ip = String(++sequence)) {
  return new Request(origin + "/api/" + path, {
    method: "POST",
    headers: { Origin: origin, "x-test-ip": ip },
    body,
  });
}
async function upload(input = bytes, consent?: string, action = "analyze") {
  const form = new FormData();
  form.set(
    "file",
    new File([new Uint8Array(input)], "PRIVATE-merchant.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  if (consent) form.set("studyConsent", consent);
  return handle(request(action, form));
}
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "feedfix-new-template-"));
  for (const [key, value] of Object.entries({
    TEMP_STORE_DIR: join(root, "analysis"),
    CORPUS_STORE_DIR: join(root, "study"),
    NOTIFICATION_STORE_DIR: join(root, "notifications"),
    USAGE_LOG_PATH: join(root, "metrics.json"),
    SCHEMA_PATH: "",
    APP_URL: origin,
    TRUSTED_IP_HEADER: "x-test-ip",
    PAYMENT_MODE: "mock",
  }))
    vi.stubEnv(key, value);
  ({ handle } = await import("../src/server/http"));
  bytes = await newTemplateBytes();
  setAnalytics({
    track: (event, properties) => {
      events.push({ event, properties });
    },
  });
});
afterAll(async () => {
  setAnalytics({ track: () => {} });
  await rm(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
it("keeps the supported analysis and original validation contract", async () => {
  const res = await upload(
    await readFile("tests/fixtures/walmart/multiple-errors.xlsx"),
  );
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.status).toBe("SUPPORTED");
  expect(data.analysis.autoFixCount).toBe(2);
  expect(data.token).toHaveLength(64);
});
it("identifies a new candidate without changing bytes, storing analysis or enabling checkout/download", async () => {
  const before = Buffer.from(bytes),
    entries = await readdir(join(root, "analysis"));
  events.length = 0;
  const response = await upload();
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toEqual({
    status: "NEW_WALMART_TEMPLATE",
    walmartDetected: true,
    supported: false,
    modified: false,
    studyShareAvailable: true,
    checkoutAvailable: false,
    contribution: { status: "not_requested" },
  });
  expect(bytes).toEqual(before);
  expect(await readdir(join(root, "analysis"))).toEqual(entries);
  expect((await new ContributionStore().list()).length).toBe(0);
  expect((await handle(request("checkout/" + "a".repeat(64), ""))).status).toBe(
    400,
  );
  expect(
    (await handle(new Request(origin + "/api/download/" + "a".repeat(64))))
      .status,
  ).toBe(400);
  expect(events.map((e) => e.event)).toContain("new_template_detected");
  expect(events.map((e) => e.event)).toContain("template_share_offered");
  expect(events.map((e) => e.event)).not.toContain("analysis_failed");
  expect(JSON.stringify(events)).not.toMatch(
    /PRIVATE|merchant|templateKey|email|Product Content/,
  );
});
it("requires separate consent to share and reuses exact original private copies with expiration", async () => {
  expect((await upload(bytes, undefined, "study-share")).status).toBe(400);
  const res = await upload(bytes, CONTRIBUTION_CONSENT_VERSION, "study-share");
  const { contribution: r, status: statusName } = await res.json();
  expect(statusName).toBe("NEW_WALMART_TEMPLATE");
  expect(r.status).toBe("saved");
  expect(await readFile(join(root, "study", r.id, "original.xlsx"))).toEqual(
    bytes,
  );
  const report = JSON.parse(
    await readFile(join(root, "study", r.id, "study.json"), "utf8"),
  );
  expect(report.templateIdentity).toEqual(
    identifyWalmartWorkbook(parseWorkbook(bytes)),
  );
  expect(Date.parse(r.expiresAt) - Date.now()).toBeLessThan(3600000);
  await new ContributionStore().cleanup(Date.parse(r.expiresAt) + 1);
  expect((await new ContributionStore().list()).length).toBe(0);
});
it("does not label a generic spreadsheet or a lone marker as Walmart", async () => {
  const generic = await (await upload(await newTemplateBytes(true))).json();
  expect(generic.status).toBe("UNKNOWN_SPREADSHEET");
  expect(generic.walmartDetected).toBe(false);
  const parsed = parseWorkbook(bytes);
  parsed.sheets = parsed.sheets.filter((s) => s.name !== "Data Definitions");
  expect(identifyWalmartWorkbook(parsed)).toBeNull();
  const visible = parseWorkbook(bytes);
  visible.sheets[2].visibility = "visible";
  expect(identifyWalmartWorkbook(visible)).toBeNull();
});
it("keeps corrupt, macro, embedded, external-link and unsafe-formula uploads as errors even with consent", async () => {
  const hostile: Buffer[] = [Buffer.from("corrupt")];
  for (const member of [
    "xl/vbaProject.bin",
    "xl/embeddings/evil.bin",
    "xl/externalLinks/externalLink1.xml",
  ]) {
    const zip = new AdmZip(bytes);
    zip.addFile(member, Buffer.from("evil"));
    hostile.push(zip.toBuffer());
  }
  const formula = new AdmZip(bytes);
  formula.updateFile(
    "xl/worksheets/sheet1.xml",
    Buffer.from(
      formula
        .readAsText("xl/worksheets/sheet1.xml")
        .replace(
          /<sheetData>/,
          '<sheetData><row r="2"><c r="A2"><f>WEBSERVICE("https://evil.test")</f><v>0</v></c></row>',
        ),
    ),
  );
  hostile.push(formula.toBuffer());
  for (const input of hostile) {
    const res = await upload(input, CONTRIBUTION_CONSENT_VERSION);
    expect(res.status).toBe(400);
    expect((await res.json()).status).toBe("INVALID_OR_UNSAFE_FILE");
  }
  expect((await new ContributionStore().list()).length).toBe(0);
});
it("classifies candidates in production with no configured mapping and never guesses one", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ALLOW_SYNTHETIC_FIXTURES", "");
  try {
    expect((await (await upload()).json()).status).toBe("NEW_WALMART_TEMPLATE");
  } finally {
    vi.stubEnv("NODE_ENV", "test");
  }
});
it("saves opt-in callback privately, redacts logs/responses/events, rejects bad tokens/email, bounds abuse and expires", async () => {
  const { contribution: r } = await (
    await upload(bytes, CONTRIBUTION_CONSENT_VERSION, "study-share")
  ).json();
  const input = {
    email: "seller@example.test",
    consentVersion: NOTIFICATION_CONSENT_VERSION,
    studyId: r.id,
    deleteToken: r.deleteToken,
  };
  const send = (data: unknown, ip?: string) =>
    handle(request("template-notification", JSON.stringify(data), ip));
  expect((await send({ ...input, email: "invalid" })).status).toBe(400);
  expect((await send({ ...input, deleteToken: "a".repeat(64) })).status).toBe(
    400,
  );
  const info = vi.spyOn(console, "info"),
    warn = vi.spyOn(console, "warn"),
    error = vi.spyOn(console, "error");
  const res = await send(input);
  expect(res.status).toBe(201);
  const publicData = await res.json();
  expect(publicData.status).toBe("SAVED");
  expect(JSON.stringify(publicData)).not.toContain(input.email);
  expect(
    JSON.stringify([
      info.mock.calls,
      warn.mock.calls,
      error.mock.calls,
      events,
    ]),
  ).not.toContain(input.email);
  info.mockRestore();
  warn.mockRestore();
  error.mockRestore();
  const path = join(root, "notifications", r.id + ".json");
  const record = JSON.parse(await readFile(path, "utf8"));
  expect(record.email).toBe(input.email);
  expect(record.expiresAt - record.createdAt).toBe(30 * 86400000 - 60000);
  expect(record.tokenHash).not.toBe(r.deleteToken);
  expect((await stat(path)).mode & 0o777).toBe(0o600);
  expect(await (await send(input)).json()).toEqual(publicData);
  expect(
    (await send({ ...input, email: "different@example.test" })).status,
  ).toBe(400);
  for (let i = 0; i < 10; i++)
    expect((await send({ ...input, email: "invalid" }, "abuser")).status).toBe(
      400,
    );
  expect((await send(input, "abuser")).status).toBe(429);
  await new ContributionStore().delete(r.id, r.deleteToken);
  expect((await send(input)).status).toBe(400);
  await new LocalTemplateNotifications().cleanup(record.expiresAt + 1);
  expect(await readdir(join(root, "notifications"))).toEqual([]);
});
it("allows authorized early callback deletion independently of the workbook", async () => {
  const { contribution: r } = await (
    await upload(bytes, CONTRIBUTION_CONSENT_VERSION, "study-share")
  ).json();
  const input = {
    email: "remove@example.test",
    consentVersion: NOTIFICATION_CONSENT_VERSION,
    studyId: r.id,
    deleteToken: r.deleteToken,
  };
  expect(
    (await handle(request("template-notification", JSON.stringify(input))))
      .status,
  ).toBe(201);
  await new ContributionStore().delete(r.id, r.deleteToken);
  expect(
    (
      await handle(
        request(
          "notification-delete/" + r.id,
          JSON.stringify({ deleteToken: "b".repeat(64) }),
        ),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await handle(
        request(
          "notification-delete/" + r.id,
          JSON.stringify({ deleteToken: r.deleteToken }),
        ),
      )
    ).status,
  ).toBe(200);
  expect(await readdir(join(root, "notifications"))).toEqual([]);
});
it("drops private analytics properties and tolerates failed analytics", async () => {
  events.length = 0;
  track("template_share_declined", {
    email: "private",
    filename: "private",
    sku: "private",
    templateKey: "private",
    sheet_count: 3,
  });
  expect(events).toEqual([
    { event: "template_share_declined", properties: { sheet_count: 3 } },
  ]);
  setAnalytics({
    track: () => {
      throw Error("offline");
    },
  });
  expect((await upload()).status).toBe(200);
  setAnalytics({ track: () => {} });
});
