import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ContributionStore,
  CONTRIBUTION_CONSENT_VERSION,
} from "../src/server/contributions";
const dirs: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "feedfix-contributions-"));
  dirs.push(dir);
  return { dir, store: new ContributionStore(dir) };
}
const workbook = () => readFile("tests/fixtures/walmart/valid.xlsx");
it("does not retain files without explicit versioned consent", async () => {
  const { dir, store } = await setup();
  expect(await store.save(await workbook(), undefined)).toEqual({
    status: "not_requested",
  });
  expect(await readdir(dir)).toEqual([]);
  expect(await store.save(await workbook(), "old")).toEqual({
    status: "not_requested",
  });
});
it("keeps exact original bytes privately with UNKNOWN provenance, receipt and deletion authorization", async () => {
  const { dir, store } = await setup();
  const input = await workbook();
  const receipt = await store.save(input, CONTRIBUTION_CONSENT_VERSION);
  expect(receipt.status).toBe("saved");
  if (receipt.status !== "saved") throw Error("missing receipt");
  expect(await readFile(join(dir, receipt.id, "original.xlsx"))).toEqual(input);
  const metadata = JSON.parse(
    await readFile(join(dir, receipt.id, "metadata.json"), "utf8"),
  );
  expect(metadata.origin).toBe("UNKNOWN");
  expect(metadata.reviewStatus).toBe("PENDING");
  expect(metadata.sourceSha256).toHaveLength(64);
  expect(metadata.consent.version).toBe(CONTRIBUTION_CONSENT_VERSION);
  expect(JSON.stringify(metadata)).not.toContain(receipt.deleteToken);
  expect(
    (await stat(join(dir, receipt.id, "original.xlsx"))).mode & 0o777,
  ).toBe(0o600);
  await expect(store.delete(receipt.id, "wrong")).rejects.toThrow(/invalid/);
  await store.delete(receipt.id, receipt.deleteToken);
  expect(await readdir(dir)).toEqual([
    "feedback.json",
    "synthetic-checks.json",
  ]);
});
it("rejects unsafe content and enforces quota without keeping partial copies", async () => {
  const { dir, store } = await setup();
  await expect(
    store.save(Buffer.from("not xlsx"), CONTRIBUTION_CONSENT_VERSION),
  ).rejects.toThrow();
  expect(await readdir(dir)).toEqual([]);
  vi.stubEnv("CORPUS_MAX_FILES", "1");
  await store.save(await workbook(), CONTRIBUTION_CONSENT_VERSION);
  await expect(
    store.save(await workbook(), CONTRIBUTION_CONSENT_VERSION),
  ).rejects.toThrow(/capacity/);
  expect(
    (await readdir(dir)).filter(
      (n) => !["feedback.json", "synthetic-checks.json"].includes(n),
    ),
  ).toHaveLength(1);
});
it("expires copies independently of temporary analysis records", async () => {
  const { dir, store } = await setup();
  const receipt = await store.save(
    await workbook(),
    CONTRIBUTION_CONSENT_VERSION,
  );
  if (receipt.status !== "saved") throw Error("missing receipt");
  await store.cleanup(Date.parse(receipt.expiresAt) + 1);
  expect(await readdir(dir)).toEqual([
    "feedback.json",
    "synthetic-checks.json",
  ]);
});
it("captures unsupported original layouts with consent and exposes only a deletion receipt", async () => {
  const { dir } = await setup();
  vi.stubEnv("CORPUS_STORE_DIR", dir);
  vi.stubEnv("SCHEMA_PATH", "");
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(await workbook());
  // Change the supported marker while retaining a safe XLSX package.
  const member = zip.getEntry("xl/sharedStrings.xml")!;
  zip.updateFile(
    member,
    Buffer.from(
      member
        .getData()
        .toString()
        .replace("FEEDFIX SYNTHETIC FIXTURE", "UNREVIEWED WALMART FILE"),
    ),
  );
  const bytes = zip.toBuffer();
  const { handle } = await import("../src/server/http");
  const upload = async (consent?: string) => {
    const form = new FormData();
    form.set(
      "file",
      new File([new Uint8Array(bytes)], "merchant.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    if (consent) form.set("studyConsent", consent);
    return handle(
      new Request("http://localhost:3000/api/analyze", {
        method: "POST",
        headers: { Origin: "http://localhost:3000" },
        body: form,
      }),
    );
  };
  const without = await upload();
  expect(without.status).toBe(400);
  expect(await readdir(dir)).toEqual([]);
  const response = await upload(CONTRIBUTION_CONSENT_VERSION);
  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.contribution.status).toBe("saved");
  expect(data.contribution.sourceSha256).toBeUndefined();
  expect(
    await readFile(join(dir, data.contribution.id, "original.xlsx")),
  ).toEqual(bytes);
  expect(
    (
      await handle(
        new Request(
          "http://localhost:3000/api/contribution/" + data.contribution.id,
        ),
      )
    ).status,
  ).toBe(404);
  const deletion = await handle(
    new Request(
      "http://localhost:3000/api/contribution/" + data.contribution.id,
      {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deleteToken: data.contribution.deleteToken }),
      },
    ),
  );
  expect(deletion.status).toBe(200);
  expect(await readdir(dir)).toEqual([
    "feedback.json",
    "synthetic-checks.json",
  ]);
});
it("a damaged receipt cannot keep expired files indefinitely", async () => {
  const { dir, store } = await setup();
  const receipt = await store.save(
    await workbook(),
    CONTRIBUTION_CONSENT_VERSION,
  );
  if (receipt.status !== "saved") throw Error("missing receipt");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(dir, receipt.id, "metadata.json"), "damaged");
  await store.cleanup(Date.now() + 60 * 60 * 1000);
  expect(await readdir(dir)).toEqual([
    "feedback.json",
    "synthetic-checks.json",
  ]);
});
it("rejects public and temporary storage overlap", async () => {
  const { dir } = await setup();
  vi.stubEnv("TEMP_STORE_DIR", dir);
  await expect(
    new ContributionStore(dir).save(
      await workbook(),
      CONTRIBUTION_CONSENT_VERSION,
    ),
  ).rejects.toThrow(/private/);
  await expect(
    new ContributionStore("public/study").save(
      await workbook(),
      CONTRIBUTION_CONSENT_VERSION,
    ),
  ).rejects.toThrow(/private/);
});
it("automatically studies candidate layouts without certifying them or retaining item values in the report", async () => {
  const { dir, store } = await setup();
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  const items = book.addWorksheet("Items");
  items.getCell("A1").value = "Version=5.0.20240827-15_55_15,MP_ITEM,example";
  items.getCell("D4").value = "SKU";
  items.getCell("D5").value = "sku";
  items.getCell("D7").value = "PRIVATE-MERCHANT-SKU";
  items.getCell("E7").value = { formula: "1+1", result: 2 };
  items.mergeCells("A2:C2");
  items.getCell("F7").dataValidation = { type: "list", formulae: ['"Yes,No"'] };
  book.addWorksheet("Hidden lists", { state: "hidden" });
  const input = Buffer.from(await book.xlsx.writeBuffer());
  const receipt = await store.save(input, CONTRIBUTION_CONSENT_VERSION);
  if (receipt.status !== "saved") throw Error("missing receipt");
  const reportPath = join(dir, receipt.id, "study.json");
  const reportText = await readFile(reportPath, "utf8");
  const report = JSON.parse(reportText);
  expect(report.origin).toBe("UNKNOWN");
  expect(report.authenticity).toBe("NOT_VERIFIED");
  expect(report.schemaCompatibility).toBe("NOT_EVALUATED");
  expect(report.repairStatus).toBe("NOT_ATTEMPTED");
  expect(report.sheets[0]).toMatchObject({
    declaredSchemaVersion: "5.0.20240827-15_55_15",
    candidateDataRows: 1,
    formulas: 1,
    mergedRanges: 1,
    dataValidations: 1,
    candidateColumns: [
      {
        column: "D",
        declaredField: "sku",
        displayName: "SKU",
        truncated: false,
      },
    ],
  });
  expect(report.sheets[1]).toMatchObject({
    name: "Hidden lists",
    order: 1,
    visibility: "hidden",
  });
  expect(report.packageMembers.length).toBeGreaterThan(5);
  expect(reportText).not.toContain("PRIVATE-MERCHANT-SKU");
  expect((await stat(reportPath)).mode & 0o777).toBe(0o600);
  expect(await store.inspect(receipt.id)).toMatchObject(report);
  expect(await readFile(join(dir, receipt.id, "original.xlsx"))).toEqual(input);
  await store.cleanup(Date.parse(receipt.expiresAt) + 1);
  expect(await readdir(dir)).toEqual([
    "feedback.json",
    "synthetic-checks.json",
  ]);
});

it("retains only fixed aggregate signals after expiry and never feeds prior consent", async () => {
  const { dir, store } = await setup();
  expect(await store.save(await workbook(), "workbook-study-1h-v1")).toEqual({
    status: "not_requested",
  });
  expect(await readdir(dir)).toEqual([]);
  const receipt = await store.save(
    await workbook(),
    CONTRIBUTION_CONSENT_VERSION,
  );
  if (receipt.status !== "saved") throw Error("missing receipt");
  const before = await store.feedback();
  expect(before.uploads).toBe(1);
  expect(before.enablesSupportOrPayments).toBe(false);
  expect(before.proposals.length).toBeGreaterThan(0);
  await store.inspect(receipt.id);
  await store.list();
  expect(await store.feedback()).toEqual(before);
  const raw = await readFile(join(dir, "feedback.json"), "utf8");
  const data = JSON.parse(raw);
  expect(Object.keys(data).sort()).toEqual(["signals", "uploads", "version"]);
  expect(Object.values(data.signals).every((v) => Number.isInteger(v))).toBe(
    true,
  );
  expect(raw).not.toContain(receipt.id);
  expect(raw).not.toContain(receipt.deleteToken);
  expect((await stat(join(dir, "feedback.json"))).mode & 0o777).toBe(0o600);
  await store.cleanup(Date.parse(receipt.expiresAt) + 1);
  expect(await readdir(dir)).toEqual([
    "feedback.json",
    "synthetic-checks.json",
  ]);
  expect(await store.feedback()).toEqual(before);
});
it("old consent copies remain deletable after upgrading consent", async () => {
  const { dir, store } = await setup();
  const receipt = await store.save(
    await workbook(),
    CONTRIBUTION_CONSENT_VERSION,
  );
  if (receipt.status !== "saved") throw Error("missing receipt");
  const { writeFile } = await import("node:fs/promises");
  const { LEGACY_CONTRIBUTION_CONSENT_TEXT } =
    await import("../src/shared/contribution-consent");
  const path = join(dir, receipt.id, "metadata.json");
  const m = JSON.parse(await readFile(path, "utf8"));
  m.consent.version = "workbook-study-1h-v1";
  m.consent.text = LEGACY_CONTRIBUTION_CONSENT_TEXT;
  await writeFile(path, JSON.stringify(m));
  await store.delete(receipt.id, receipt.deleteToken);
  expect(await readdir(dir)).toEqual([
    "feedback.json",
    "synthetic-checks.json",
  ]);
});
