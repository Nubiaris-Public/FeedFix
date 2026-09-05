import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("../src/server/store", () => ({ startCleanup: vi.fn() }));
import { GET } from "../src/app/api/health/route";

const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
it("checks writable storage without requiring Stripe or a schema", async () => {
  const path = await mkdtemp(join(tmpdir(), "feedfix-health-"));
  directories.push(path);
  vi.stubEnv("TEMP_STORE_DIR", join(path, "files"));
  vi.stubEnv("USAGE_LOG_PATH", join(path, "metrics/usage.json"));
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("fails readiness without revealing a broken storage path", async () => {
  const path = await mkdtemp(join(tmpdir(), "feedfix-health-"));
  directories.push(path);
  await writeFile(join(path, "blocked"), "not a directory");
  vi.stubEnv("TEMP_STORE_DIR", join(path, "blocked"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: "unavailable" });
});
