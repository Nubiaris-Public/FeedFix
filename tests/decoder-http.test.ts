import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  mkdtemp,
  readdir,
  readFile,
  stat,
  rm,
  mkdir,
  symlink,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  UnknownErrorStore,
  UNKNOWN_RETENTION_MS,
} from "../src/server/unknown-errors";
import { UNKNOWN_CONSENT_VERSION, redactMessage } from "../src/decoder/input";
import { setAnalytics, track } from "../src/server/analytics";
let root: string;
let handle: typeof import("../src/server/http").handle;
const origin = "http://localhost:3000";
let requestNumber = 0;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "feedfix-decoder-"));
  for (const [key, value] of Object.entries({
    APP_URL: origin,
    TEMP_STORE_DIR: join(root, "analysis"),
    CORPUS_STORE_DIR: join(root, "study"),
    NOTIFICATION_STORE_DIR: join(root, "notifications"),
    UNKNOWN_ERROR_STORE_DIR: join(root, "errors"),
    USAGE_LOG_PATH: join(root, "metrics/usage.json"),
    TRUSTED_IP_HEADER: "x-test-client",
  }))
    vi.stubEnv(key, value);
  ({ handle } = await import("../src/server/http"));
});
afterEach(() => {
  setAnalytics({ track: () => {} });
  vi.restoreAllMocks();
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});
const request = (
  path: string,
  body: unknown,
  client = String(++requestNumber),
  headers = {},
) =>
  handle(
    new Request(origin + "/api/" + path, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-test-client": client,
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const files = async () =>
  readdir(join(root, "errors")).catch(() => [] as string[]);
it.each([
  ["Missing attribute metadata", "DOCUMENTED"],
  ["Missing required attribute: color", "LIKELY_MATCH"],
  ["The moon ate the upload", "UNKNOWN"],
])("POST %s returns %s without persistence", async (message, status) => {
  const before = await files();
  const response = await request("error-decoder", { message });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ status });
  expect(await files()).toEqual(before);
});
it("requires literal consent and stores only a redacted bounded record", async () => {
  const message =
    "Unexpected moon issue seller@example.test https://private.test/file?token=abc merchant.xlsx SKU: XYZ-12";
  for (const consent of [undefined, false, "true"])
    expect(
      (
        await request("error-decoder-share", {
          message,
          consentVersion: UNKNOWN_CONSENT_VERSION,
          consent,
        })
      ).status,
    ).toBe(400);
  expect(await files()).toEqual([]);
  expect(
    (
      await request("error-decoder-share", {
        message,
        consentVersion: UNKNOWN_CONSENT_VERSION,
        consent: true,
      })
    ).status,
  ).toBe(409);
  expect(await files()).toEqual([]);
  const reviewed = redactMessage(message);
  const response = await request("error-decoder-share", {
    message: reviewed,
    consentVersion: UNKNOWN_CONSENT_VERSION,
    consent: true,
  });
  expect(response.status).toBe(201);
  const receipt = await response.json();
  expect(Date.parse(receipt.expiresAt) - Date.now()).toBeLessThan(7 * 86400000);
  const names = await files();
  expect(names).toHaveLength(1);
  const path = join(root, "errors", names[0]);
  const raw = await readFile(path, "utf8");
  expect(JSON.parse(raw).message).toBe(reviewed);
  expect(raw).not.toMatch(
    /seller@|private.test|merchant|XYZ-12|cookie|authorization|filename|ipAddress/,
  );
  expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
    "consentVersion",
    "createdAt",
    "expiresAt",
    "message",
  ]);
  expect((await stat(path)).mode & 0o777).toBe(0o600);
  expect((await stat(join(root, "errors"))).mode & 0o777).toBe(0o700);
});
it("rejects known sharing, wrong origin, malformed, empty, oversized and streaming bodies", async () => {
  expect(
    (
      await request("error-decoder-share", {
        message: "Missing attribute metadata",
        consentVersion: UNKNOWN_CONSENT_VERSION,
        consent: true,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request("error-decoder", { message: "test" }, undefined, {
        origin: "https://evil.test",
      })
    ).status,
  ).toBe(403);
  expect((await request("error-decoder", "{")).status).toBe(400);
  expect((await request("error-decoder", { message: "" })).status).toBe(400);
  expect(
    (await request("error-decoder", { message: "x".repeat(4001) })).status,
  ).toBe(400);
  expect((await request("error-decoder", "x".repeat(25000))).status).toBe(413);
  expect(
    (
      await request("error-decoder", { message: "x" }, undefined, {
        "content-length": "99999",
      })
    ).status,
  ).toBe(413);
  expect(
    (
      await request("error-decoder", { message: "x" }, undefined, {
        "content-type": "text/plain",
      })
    ).status,
  ).toBe(415);
  expect(
    (await request("error-decoder", { message: "x", filename: "private.xlsx" }))
      .status,
  ).toBe(400);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(25000));
      controller.close();
    },
  });
  const response = await handle(
    new Request(origin + "/api/error-decoder", {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-test-client": String(++requestNumber),
      },
      body: stream,
      duplex: "half",
    } as RequestInit),
  );
  expect(response.status).toBe(413);
});
it("limits decoding and sharing independently", async () => {
  for (let n = 0; n < 20; n++)
    expect(
      (await request("error-decoder", { message: "unknown" }, "rate-decoder"))
        .status,
    ).toBe(200);
  expect(
    (await request("error-decoder", { message: "unknown" }, "rate-decoder"))
      .status,
  ).toBe(429);
  for (let n = 0; n < 5; n++)
    expect(
      (
        await request(
          "error-decoder-share",
          { message: "unknown", consent: false },
          "rate-share",
        )
      ).status,
    ).toBe(400);
  expect(
    (await request("error-decoder-share", { message: "unknown" }, "rate-share"))
      .status,
  ).toBe(429);
});
it("does not leak raw text or arbitrary analytics dimensions; analytics outages do not fail decoding", async () => {
  const spy = vi.fn();
  setAnalytics({ track: spy });
  const message = "Missing attribute metadata https://private.test/secret";
  await request("error-decoder", { message });
  expect(spy).toHaveBeenCalledWith("error_decoder_documented_match", {
    entry_id: "missing-attribute-metadata",
    confidence: "DOCUMENTED",
    error_family: "missing-attribute-metadata",
    source: "unknown",
    is_example: 0,
  });
  track("error_decoder_unknown", {
    message,
    entry_id: message,
    confidence: message,
    error_family: message,
    issue_count: 123456789012,
  });
  expect(spy).toHaveBeenLastCalledWith("error_decoder_unknown", {
    source: "unknown",
    is_example: 0,
  });
  expect(JSON.stringify(spy.mock.calls)).not.toMatch(
    /private|secret|123456789012/,
  );
  for (const implementation of [
    () => {
      throw new Error("telemetry failure");
    },
    async () => {
      throw new Error("telemetry failure");
    },
  ]) {
    setAnalytics({ track: implementation });
    expect((await request("error-decoder", { message })).status).toBe(200);
  }
});
it("removes expired records on cleanup and rejects public or symlinked storage", async () => {
  const store = new UnknownErrorStore(join(root, "errors"));
  await store.cleanup(Date.now() + UNKNOWN_RETENTION_MS + 1);
  expect(await files()).toEqual([]);
  await expect(
    new UnknownErrorStore("public/errors").save(
      "unknown",
      UNKNOWN_CONSENT_VERSION,
    ),
  ).rejects.toThrow();
  await mkdir(join(root, "actual"));
  await symlink(join(root, "actual"), join(root, "linked"));
  await expect(
    new UnknownErrorStore(join(root, "linked")).save(
      "unknown",
      UNKNOWN_CONSENT_VERSION,
    ),
  ).rejects.toThrow();
});

it("the storage boundary independently refuses text that still needs redaction", async () => {
  const before = await files();
  await expect(
    new UnknownErrorStore(join(root, "errors")).save(
      'Unknown: "Private File Name.xlsx"',
      UNKNOWN_CONSENT_VERSION,
    ),
  ).rejects.toThrow("Review the final redacted text");
  expect(await files()).toEqual(before);
});
