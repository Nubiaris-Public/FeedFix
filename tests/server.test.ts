import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseWorkbook } from "../src/engine/workbook";
let directory: string;
let handle: typeof import("../src/server/http").handle;
const origin = "http://localhost:3000";
function request(
  path: string,
  method = "GET",
  token?: string,
  body?: BodyInit,
) {
  return new Request(origin + "/api/" + path, {
    method,
    headers: {
      Origin: origin,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body,
  });
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "feedfix-test-"));
  vi.stubEnv("TEMP_STORE_DIR", directory);
  vi.stubEnv("USAGE_LOG_PATH", join(directory, "metrics", "usage.json"));
  vi.stubEnv("PAYMENT_MODE", "mock");
  vi.stubEnv("APP_URL", origin);
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_feedfix_local_test");
  vi.stubEnv("SCHEMA_PATH", "");
  ({ handle } = await import("../src/server/http"));
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
async function upload(name = "multiple-errors") {
  const form = new FormData();
  form.set(
    "file",
    new File(
      [await readFile(`tests/fixtures/walmart/${name}.xlsx`)],
      "../../hostile.xlsx",
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ),
  );
  const response = await handle(request("analyze", "POST", undefined, form));
  expect(response.status).toBe(200);
  return response.json();
}
it("HTTP integration: free download → optional signed payment → repeat download", async () => {
  const { token, analysis } = await upload();
  expect(analysis.autoFixCount).toBe(2);
  expect(
    analysis.issues.every(
      (i: Record<string, unknown>) =>
        i.resolution !== "AUTO_FIX" ||
        ("originalValue" in i && "proposedValue" in i),
    ),
  ).toBe(true);
  expect(
    (await handle(request("download/" + analysis.id, "GET", token))).status,
  ).toBe(200);
  expect(
    (await handle(request("analysis/" + analysis.id, "GET", "wrong"))).status,
  ).toBe(400);
  const checkout = await handle(
    request("checkout/" + analysis.id, "POST", token),
  );
  expect(checkout.status).toBe(200);
  const again = await handle(request("checkout/" + analysis.id, "POST", token));
  expect(await again.json()).toEqual(await checkout.json());
  expect(
    (await handle(request("mock-payment/" + analysis.id, "POST", token)))
      .status,
  ).toBe(200);
  expect(
    (await handle(request("mock-payment/" + analysis.id, "POST", token)))
      .status,
  ).toBe(200);
  const download = await handle(
    request("download/" + analysis.id, "GET", token),
  );
  expect(download.status).toBe(200);
  expect(download.headers.get("cache-control")).toBe("no-store");
  const workbook = parseWorkbook(Buffer.from(await download.arrayBuffer()));
  expect(workbook.sheets[0].cells.get("C3")?.value).toBe("Fictional blue cup");
  expect(workbook.sheets[0].cells.get("B4")?.value).toBe("036000291453");
  const report = await (
    await handle(request("download/" + analysis.id + "?report=1", "GET", token))
  ).json();
  expect(report.changes).toHaveLength(2);
  expect(report.remainingIssues).toHaveLength(3);
  const { LocalTemporaryFileStore } = await import("../src/server/store");
  const restarted = new LocalTemporaryFileStore(directory);
  expect((await restarted.get(analysis.id))?.status).toBe("PAID");
  const stored = await restarted.get(analysis.id);
  await restarted.put({ ...stored!, expiresAt: Date.now() - 1 });
  await restarted.cleanup();
  expect((await readdir(directory)).includes(analysis.id + ".json")).toBe(
    false,
  );
  expect(
    (await handle(request("download/" + analysis.id, "GET", token))).status,
  ).toBe(400);
});
it("rejects forged webhook signatures and cross-origin requests", async () => {
  const res = await handle(
    request(
      "webhook",
      "POST",
      undefined,
      '{"type":"checkout.session.completed"}',
    ),
  );
  expect(res.status).toBe(400);
  const cross = new Request(origin + "/api/analyze", {
    method: "POST",
    headers: { Origin: "https://evil.example" },
  });
  expect((await handle(cross)).status).toBe(403);
});
it("does not offer payment for valid files", async () => {
  const { analysis, token } = await upload("valid");
  expect(analysis.autoFixCount).toBe(0);
  expect(
    (await handle(request("checkout/" + analysis.id, "POST", token))).status,
  ).toBe(400);
});
it("production cannot use mock payments and requires configured Stripe", async () => {
  const { analysis, token } = await upload();
  await handle(request("download/" + analysis.id, "GET", token));
  vi.stubEnv("NODE_ENV", "production");
  try {
    expect(
      (await handle(request("mock-payment/" + analysis.id, "POST", token)))
        .status,
    ).toBe(404);
    expect(
      (
        await (
          await handle(request("checkout/" + analysis.id, "POST", token))
        ).json()
      ).error,
    ).toMatch(/Checkout is not configured/);
  } finally {
    vi.stubEnv("NODE_ENV", "test");
  }
});
it("rejects oversized streaming body independent of content-length", async () => {
  const { boundedBody } = await import("../src/server/http");
  await expect(
    boundedBody(request("analyze", "POST", undefined, "123456789"), 4),
  ).rejects.toThrow(/large/);
});
it("analytics removes content and tolerates synchronous and asynchronous failures", async () => {
  const { setAnalytics, track } = await import("../src/server/analytics");
  const spy = vi.fn();
  setAnalytics({ track: spy });
  track("issues_found", {
    issue_count: 3,
    sku: "secret",
    file_size_bucket: "merchant",
  });
  expect(spy).toHaveBeenCalledWith("issues_found", {
    issue_count: 3,
    source: "unknown",
    is_example: 0,
  });
  setAnalytics({
    track: () => {
      throw new Error("offline");
    },
  });
  expect(() => track("landing_view")).not.toThrow();
  setAnalytics({
    track: async () => {
      throw new Error("offline");
    },
  });
  track("landing_view");
  await new Promise((resolve) => setTimeout(resolve, 0));
  setAnalytics({ track: () => {} });
});

it("blank optional Stripe secrets still allow the documented local mock flow", async () => {
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
  const { analysis, token } = await upload();
  await handle(request("download/" + analysis.id, "GET", token));
  expect(
    (await handle(request("checkout/" + analysis.id, "POST", token))).status,
  ).toBe(200);
  expect(
    (await handle(request("mock-payment/" + analysis.id, "POST", token)))
      .status,
  ).toBe(200);
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_feedfix_local_test");
});

it("signed events cannot fulfill a different session, amount or unpaid checkout", async () => {
  const { analysis, token } = await upload();
  await handle(request("download/" + analysis.id, "GET", token));
  await handle(request("checkout/" + analysis.id, "POST", token));
  const { webhook, stripe } = await import("../src/server/payment");
  const send = async (patch: Record<string, unknown>) => {
    const payload = JSON.stringify({
      id: "evt_test",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_" + analysis.id,
          client_reference_id: analysis.id,
          metadata: { analysisId: analysis.id },
          payment_status: "paid",
          mode: "payment",
          currency: "usd",
          amount_total: 499,
          ...patch,
        },
      },
    });
    const signature = stripe().webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_feedfix_local_test",
    });
    return webhook(payload, signature);
  };
  await expect(send({ id: "cs_other" })).rejects.toThrow(/verification/);
  await expect(send({ amount_total: 1 })).rejects.toThrow(/verification/);
  await send({ payment_status: "unpaid" });
  expect(
    (
      await (
        await handle(request("analysis/" + analysis.id, "GET", token))
      ).json()
    ).status,
  ).toBe("ANALYZED");
});

it("free repeated downloads count once, reports do not count, feedback is optional and private", async () => {
  const { UsageLog } = await import("../src/server/usage");
  const log = new UsageLog();
  const before = (await log.summary()).totals.synthetic.corrected_files;
  const { analysis, token } = await upload();
  expect(
    (
      await handle(
        request(
          "feedback/" + analysis.id,
          "POST",
          token,
          JSON.stringify({ outcome: "YES" }),
        ),
      )
    ).status,
  ).toBe(400);
  await handle(request("download/" + analysis.id + "?report=1", "GET", token));
  expect((await log.summary()).totals.synthetic.corrected_files).toBe(before);
  await Promise.all([
    handle(request("download/" + analysis.id, "GET", token)),
    handle(request("download/" + analysis.id, "GET", token)),
  ]);
  expect((await log.summary()).totals.synthetic.corrected_files).toBe(
    before + 1,
  );
  expect(
    (
      await handle(
        request(
          "feedback/" + analysis.id,
          "POST",
          "wrong",
          JSON.stringify({ outcome: "YES" }),
        ),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await handle(
        request(
          "feedback/" + analysis.id,
          "POST",
          token,
          JSON.stringify({ outcome: "bad" }),
        ),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await handle(
        request(
          "feedback/" + analysis.id,
          "POST",
          token,
          JSON.stringify({ outcome: "YES" }),
        ),
      )
    ).status,
  ).toBe(200);
  expect((await handle(request("usage", "GET"))).status).toBe(404);
});
it("log write failures cannot block free downloads and retries can recover the count", async () => {
  const { UsageLog } = await import("../src/server/usage");
  const { analysis, token } = await upload();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const fail = vi
    .spyOn(UsageLog.prototype, "corrected")
    .mockRejectedValueOnce(new Error("disk failure"));
  expect(
    (await handle(request("download/" + analysis.id, "GET", token))).status,
  ).toBe(200);
  expect(warn).toHaveBeenCalledWith(
    JSON.stringify({ event: "correction_log_write_failed" }),
  );
  fail.mockRestore();
  warn.mockRestore();
  const before = (await new UsageLog().summary()).totals.synthetic
    .corrected_files;
  await handle(request("download/" + analysis.id, "GET", token));
  expect(
    (await new UsageLog().summary()).totals.synthetic.corrected_files,
  ).toBe(before + 1);
});
