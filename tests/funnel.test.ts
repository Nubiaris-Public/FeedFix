import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  track,
  setAnalytics,
  withAnalyticsRequest,
} from "../src/server/analytics";
import { flushFunnel, funnelPath, readFunnel } from "../src/server/funnel";
let root: string;
let handle: typeof import("../src/server/http").handle;
let n = 0;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "feedfix-funnel-"));
  for (const [k, v] of Object.entries({
    APP_URL: "http://localhost:3000",
    USAGE_LOG_PATH: join(root, "usage.json"),
    FUNNEL_TEST_ENABLED: "true",
    TEMP_STORE_DIR: join(root, "files"),
    CORPUS_STORE_DIR: join(root, "study"),
    UNKNOWN_ERROR_STORE_DIR: join(root, "errors"),
    NOTIFICATION_STORE_DIR: join(root, "notifications"),
    TRUSTED_IP_HEADER: "x-test-client",
  }))
    vi.stubEnv(k, v);
  ({ handle } = await import("../src/server/http"));
});
afterEach(() => setAnalytics({ track: () => {} }));
afterAll(async () => {
  await flushFunnel();
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});
function request(
  body: unknown,
  context: unknown = {},
  action = "error-decoder",
) {
  return handle(
    new Request(`http://localhost:3000/api/${action}`, {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
        "x-test-client": String(++n),
        "x-feedfix-context": JSON.stringify(context),
      },
      body: JSON.stringify(body),
    }),
  );
}
it("server resolves demos, separates real requests and persists bounded aggregate counts", async () => {
  const spy = vi.fn();
  setAnalytics({ track: spy });
  expect(
    (
      await request(
        { example_id: "missing-attribute-metadata" },
        {
          guide_id: "walmart-missing-attribute-metadata",
          source: "paid",
          token: "PRIVATE",
        },
      )
    ).status,
  ).toBe(200);
  expect(
    (await request({ message: "Missing attribute metadata" })).status,
  ).toBe(200);
  const calls = spy.mock.calls.filter(
    (c) => c[0] === "error_decoder_documented_match",
  );
  expect(calls.map((c) => c[1].is_example)).toEqual([1, 0]);
  expect(calls[0][1].guide_id).toBe("walmart-missing-attribute-metadata");
  expect(calls[0][1].source).toBe("paid");
  const stored = await readFile(funnelPath(), "utf8");
  expect(stored).toContain("error_decoder_documented_match");
  expect(stored).not.toMatch(
    /PRIVATE|Missing attribute metadata|token|requestId|x-test-client/,
  );
  expect((await stat(funnelPath())).mode & 0o777).toBe(0o600);
  expect(Object.keys((await readFunnel()).days)).toHaveLength(1);
});
it("rejects forged examples and browser server-confirmation events", async () => {
  const spy = vi.fn();
  setAnalytics({ track: spy });
  expect(
    (await request({ example_id: "https://evil.test/PRIVATE" })).status,
  ).toBe(400);
  expect(
    (await request({ message: "hello", example_id: "product-id" })).status,
  ).toBe(400);
  await request(
    { event: "analysis_completed", properties: { is_example: 0 } },
    {},
    "events",
  );
  expect(spy).not.toHaveBeenCalled();
});
it("isolates concurrent request context and discards unsafe dimensions even if adapters fail", async () => {
  const spy = vi.fn();
  setAnalytics({ track: spy });
  await Promise.all(
    ["walmart-sku-already-used", "walmart-processing-report"].map((guide_id) =>
      withAnalyticsRequest(
        "api",
        async () => {
          await Promise.resolve();
          track("guide_viewed", {
            message: "PRIVATE",
            guide_id: "PRIVATE",
            source: "PRIVATE",
            is_example: 1,
          });
        },
        { guide_id, source: "referral" },
      ),
    ),
  );
  expect(new Set(spy.mock.calls.map((c) => c[1].guide_id)).size).toBe(2);
  expect(JSON.stringify(spy.mock.calls)).not.toContain("PRIVATE");
  expect(spy.mock.calls.every((c) => c[1].is_example === 0)).toBe(true);
  setAnalytics({
    track: () => {
      throw Error("adapter failure");
    },
  });
  expect((await request({ example_id: "product-id" })).status).toBe(200);
});
