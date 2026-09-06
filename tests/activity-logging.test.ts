import type { MockInstance } from "vitest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { track, withAnalyticsRequest } from "../src/server/analytics";
let directory: string;
let handle: typeof import("../src/server/http").handle;
let log: MockInstance<typeof console.info>;
const origin = "http://localhost:3000";
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "feedfix-activity-"));
  for (const [key, value] of Object.entries({
    APP_URL: origin,
    TEMP_STORE_DIR: join(directory, "analysis"),
    CORPUS_STORE_DIR: join(directory, "study"),
    NOTIFICATION_STORE_DIR: join(directory, "notifications"),
    USAGE_LOG_PATH: join(directory, "usage.json"),
  }))
    vi.stubEnv(key, value);
  ({ handle } = await import("../src/server/http"));
});
beforeEach(() => {
  vi.stubEnv("ANALYTICS_ENABLED", "false");
  vi.stubEnv("CONSOLE_ACTIVITY_ENABLED", undefined);
  log = vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
const post = (path: string, body: BodyInit) =>
  handle(
    new Request(origin + "/api/" + path, {
      method: "POST",
      headers: { Origin: origin },
      body,
    }),
  );
it("logs a real browser visit event by default without private properties", async () => {
  const response = await post(
    "events",
    JSON.stringify({
      event: "landing_view",
      properties: {
        email: "private@example.test",
        filename: "private.xlsx",
        url: "/secret",
      },
    }),
  );
  expect(response.status).toBe(200);
  expect(log).toHaveBeenCalledTimes(1);
  const entry = JSON.parse(log.mock.calls[0][0]);
  expect(entry).toMatchObject({
    event: "landing_view",
    level: "info",
    entryPoint: "browser_event",
    properties: {},
  });
  expect(entry.requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
  expect(JSON.stringify(entry)).not.toMatch(/private|secret/);
});
it("logs received uploads before validation, and distinguishes a study reupload", async () => {
  for (const action of ["analyze", "study-share"]) {
    const form = new FormData();
    form.set("file", new File(["corrupt"], "private-seller.xlsx"));
    const response = await post(action, form);
    expect(response.status).toBe(400);
  }
  const entries = log.mock.calls.map((call) => JSON.parse(call[0]));
  expect(entries.map((e) => e.event)).toEqual([
    "upload_completed",
    "upload_completed",
  ]);
  expect(entries.map((e) => e.entryPoint)).toEqual(["analyze", "study_share"]);
  expect(entries[0].properties).toEqual({ file_size_bucket: "small" });
  expect(entries[0].requestId).not.toBe(entries[1].requestId);
  expect(JSON.stringify(entries)).not.toMatch(/private|corrupt/);
});
it("does not treat file selection or forged client upload events as received files", async () => {
  await post("events", JSON.stringify({ event: "file_selected" }));
  await post("events", JSON.stringify({ event: "upload_completed" }));
  await post("analyze", new FormData());
  expect(log).not.toHaveBeenCalled();
});
it("allows explicit activity opt-out independently of detailed analytics", () => {
  vi.stubEnv("CONSOLE_ACTIVITY_ENABLED", "false");
  vi.stubEnv("ANALYTICS_ENABLED", "true");
  track("landing_view");
  track("upload_completed");
  track("analysis_completed");
  expect(log).toHaveBeenCalledTimes(1);
  expect(JSON.parse(log.mock.calls[0][0]).event).toBe("analysis_completed");
});
it("preserves request correlation across concurrent async operations", async () => {
  await Promise.all(
    ["analyze", "study_share"].map((entryPoint) =>
      withAnalyticsRequest(
        entryPoint as "analyze" | "study_share",
        async () => {
          track("upload_completed");
          await Promise.resolve();
          track("upload_completed");
        },
      ),
    ),
  );
  const entries = log.mock.calls.map((call) => JSON.parse(call[0]));
  for (const point of ["analyze", "study_share"])
    expect(
      new Set(
        entries.filter((e) => e.entryPoint === point).map((e) => e.requestId),
      ).size,
    ).toBe(1);
  expect(new Set(entries.map((e) => e.requestId)).size).toBe(2);
});
it("a failing console sink cannot break a visit request", async () => {
  log.mockImplementation(() => {
    throw Error("logging unavailable");
  });
  expect(
    (await post("events", JSON.stringify({ event: "landing_view" }))).status,
  ).toBe(200);
});
