import { beforeAll, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, truncateSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ExcelJS from "exceljs";
import AdmZip from "adm-zip";
import { compile } from "../tools/walmart-schema/compiler";
import {
  hydrateOfficialFields,
  officialRuntime,
} from "../src/engine/compiled-runtime";
import { validateWorkbook } from "../src/engine/validate";
import { parseWorkbook } from "../src/engine/workbook";
import { buildFixPlan, applyApprovedAutomaticFixes } from "../src/engine/fix";
import { verifyWorkbookIntegrity } from "../src/engine/integrity";
import type { MarketplaceSchema } from "../src/engine/model";
let schema: MarketplaceSchema;
const category = {
  type: "object",
  additionalProperties: false,
  required: ["color", "name"],
  properties: {
    color: { type: "string", enum: ["Red", "Blue", "Green"] },
    name: {
      type: "string",
      minLength: 2,
      maxLength: 6,
      pattern: "^[A-Z][a-z]+$",
    },
    weight: { type: "number", minimum: 0, maximum: 10 },
    tags: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      uniqueItems: true,
      items: { type: "string" },
    },
    code: { $ref: "#/definitions/code" },
  },
  if: { required: ["color"], properties: { color: { const: "Red" } } },
  then: { required: ["weight"] },
};
const source = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["MPItem", "MPItemFeedHeader"],
  properties: {
    MPItemFeedHeader: {
      type: "object",
      properties: { version: { enum: ["TEST-RUNTIME"] } },
      required: ["version"],
    },
    MPItem: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["Visible"],
        properties: {
          Visible: {
            type: "object",
            additionalProperties: false,
            oneOf: [{ required: ["Test"] }],
            properties: { Test: category },
          },
        },
      },
    },
  },
  definitions: { code: { type: "string", pattern: "^X" } },
};
beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "feedfix-runtime-"));
  const input = join(dir, "source.json");
  writeFileSync(input, JSON.stringify(source));
  const manifest = await compile(input, join(dir, "compiled"));
  schema = hydrateOfficialFields({
    marketplace: "walmart",
    version: "TEST-RUNTIME",
    synthetic: true,
    origin: "SYNTHETIC",
    provenance: "Synthetic compiler contract; no official workbook evidence",
    sheet: "Items",
    headerRow: 2,
    marker: { cell: "A1", value: "SYNTHETIC" },
    compiled: {
      directory: join(dir, "compiled"),
      sourceSha256: manifest.sourceSha256,
      productType: "Test",
      feedHeader: { version: "TEST-RUNTIME" },
    },
    fields: ["color", "name", "weight", "tags", "code"].map((column) => ({
      column,
      canonicalPath: "/Visible/Test/" + column,
      schemaPath:
        "#/properties/MPItem/items/properties/Visible/properties/Test/properties/" +
        column,
      encoding:
        column === "weight" ? "number" : column === "tags" ? "json" : "text",
    })),
  });
});
async function workbook(values: unknown[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Golden synthetic";
  wb.created = new Date("2025-01-01");
  const s = wb.addWorksheet("Items");
  s.addRow(["SYNTHETIC"]);
  s.addRow(schema.fields.map((f) => f.column));
  s.addRow(values);
  s.getCell("A3").font = { bold: true };
  s.getCell("A3").dataValidation = {
    type: "list",
    formulae: ['"Red,Blue,Green"'],
  };
  const hidden = wb.addWorksheet("Metadata", { state: "veryHidden" });
  hidden.getCell("A1").value = { formula: "SUM(1,2)", result: 3 };
  hidden.mergeCells("B2:C2");
  wb.definedNames.add("Metadata!$A$1", "MetaValue");
  return Buffer.from(await wb.xlsx.writeBuffer());
}
it.each([
  ["missing required", ["Blue", ""], "REQUIRED"],
  ["enum", ["purple", "Valid"], "ENUM"],
  ["minimum", ["Blue", "Valid", -1], "MINIMUM"],
  ["maximum", ["Blue", "Valid", 11], "MAXIMUM"],
  ["min length", ["Blue", "A"], "MINLENGTH"],
  ["max length", ["Blue", "Toolongname"], "MAXLENGTH"],
  ["pattern", ["Blue", "valid"], "PATTERN"],
  ["conditional", ["Red", "Valid"], "REQUIRED"],
  ["array minimum", ["Blue", "Valid", 1, "[]"], "MINITEMS"],
  ["array maximum", ["Blue", "Valid", 1, '["a","b","c"]'], "MAXITEMS"],
  ["array uniqueness", ["Blue", "Valid", 1, '["a","a"]'], "UNIQUEITEMS"],
  ["reference", ["Blue", "Valid", 1, undefined, "bad"], "PATTERN"],
] as [string, unknown[], string][])("%s", async (_, values, code) => {
  const result = validateWorkbook(
    parseWorkbook(await workbook(values)),
    schema,
  );
  expect(result.issues.some((i) => i.code === code)).toBe(true);
  expect(buildFixPlan(result.issues)).toEqual([]);
});
it("valid row uses compiled assertions and preserves official references", async () => {
  expect(
    validateWorkbook(
      parseWorkbook(await workbook(["Blue", "Valid", 1, '["one"]', "X1"])),
      schema,
    ).issues,
  ).toEqual([]);
  expect(officialRuntime(schema).graph.manifest.sourceSha256).toHaveLength(64);
});
it("reports simultaneous failures without inventing values", async () => {
  const issues = validateWorkbook(
    parseWorkbook(await workbook(["purple", "bad", -1])),
    schema,
  ).issues;
  expect(issues.length).toBeGreaterThanOrEqual(3);
  expect(issues.every((i) => i.fixability === "REVIEW_REQUIRED")).toBe(true);
});
it("repairs unambiguous enum only when whole-row revalidation succeeds; structure and bytes are idempotent", async () => {
  const input = await workbook([" blue ", "Valid"]);
  const plan = buildFixPlan(
    validateWorkbook(parseWorkbook(input), schema).issues,
  );
  expect(plan).toHaveLength(1);
  expect(plan[0].after).toBe("Blue");
  const out = applyApprovedAutomaticFixes(parseWorkbook(input), plan);
  expect(verifyWorkbookIntegrity(input, out, plan).status).toBe("PASS");
  const result = validateWorkbook(parseWorkbook(out), schema);
  expect(result.issues).toEqual([]);
  expect(
    applyApprovedAutomaticFixes(
      parseWorkbook(out),
      buildFixPlan(result.issues),
    ),
  ).toEqual(out);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(out as unknown as ExcelJS.Buffer);
  expect(wb.worksheets.map((s) => s.name)).toEqual(["Items", "Metadata"]);
  expect(wb.worksheets[1].state).toBe("veryHidden");
  expect(wb.worksheets[1].getCell("A1").formula).toBe("SUM(1,2)");
  expect(wb.creator).toBe("Golden synthetic");
  const corrupted = new AdmZip(out);
  corrupted.updateFile(
    "xl/workbook.xml",
    Buffer.from(
      corrupted.readAsText("xl/workbook.xml").replace("veryHidden", "visible"),
    ),
  );
  expect(() =>
    verifyWorkbookIntegrity(input, corrupted.toBuffer(), plan),
  ).toThrow(/integrity/);
  const style = new AdmZip(out);
  style.updateFile(
    "xl/worksheets/sheet1.xml",
    Buffer.from(
      style
        .readAsText("xl/worksheets/sheet1.xml")
        .replace('r="A3" s="1"', 'r="A3" s="99"'),
    ),
  );
  expect(() => verifyWorkbookIntegrity(input, style.toBuffer(), plan)).toThrow(
    /integrity/,
  );
});
it("a spelling correction cannot silently activate a conditional requirement", async () => {
  const issues = validateWorkbook(
    parseWorkbook(await workbook([" red ", "Valid"])),
    schema,
  ).issues;
  expect(buildFixPlan(issues)).toEqual([]);
});
it("cannot treat formula results as validated values", async () => {
  const issues = validateWorkbook(
    parseWorkbook(
      await workbook([{ formula: '"Blue"', result: "Blue" }, "Valid"]),
    ),
    schema,
  ).issues;
  expect(issues.some((i) => i.fixability === "UNSUPPORTED")).toBe(true);
  expect(buildFixPlan(issues)).toEqual([]);
});
it("refuses the giant source before readFile/JSON.parse in runtime", async () => {
  const { getSchema } = await import("../src/engine/schema");
  const previous = process.env.SCHEMA_PATH;
  const large = join(
    mkdtempSync(join(tmpdir(), "feedfix-large-")),
    "source.json",
  );
  writeFileSync(large, "{}");
  truncateSync(large, 451013258);
  process.env.SCHEMA_PATH = large;
  try {
    expect(() => getSchema()).toThrow(/small reviewed/);
  } finally {
    if (previous === undefined) delete process.env.SCHEMA_PATH;
    else process.env.SCHEMA_PATH = previous;
  }
});
it("rejects numeric precision loss in number and JSON cell encodings", async () => {
  const { decodeCell } = await import("../src/engine/compiled-runtime");
  expect(() =>
    decodeCell("9007199254740993", { column: "n", encoding: "number" }),
  ).toThrow(/precision/);
  expect(() =>
    decodeCell("[9007199254740993]", { column: "n", encoding: "json" }),
  ).toThrow(/precision/);
  expect(() =>
    decodeCell("0.1000000000000000001", { column: "n", encoding: "number" }),
  ).toThrow(/precision/);
  expect(decodeCell("4.99", { column: "n", encoding: "number" })).toBe(4.99);
});
it("a warmed runtime cache cannot hide a mismatched schema version", () => {
  officialRuntime(schema);
  expect(() => officialRuntime({ ...schema, version: "wrong" })).toThrow(
    /provenance/,
  );
});
it("preserves array-level assertions across all workbook rows", async () => {
  const dir = mkdtempSync(join(tmpdir(), "feedfix-feed-array-"));
  const modified = {
    ...source,
    properties: {
      ...source.properties,
      MPItem: {
        ...source.properties.MPItem,
        minItems: 2,
        maxItems: 2,
        uniqueItems: true,
      },
    },
  };
  const input = join(dir, "source.json");
  writeFileSync(input, JSON.stringify(modified));
  const manifest = await compile(input, join(dir, "compiled"));
  const mapping = hydrateOfficialFields({
    ...schema,
    compiled: {
      ...schema.compiled!,
      directory: join(dir, "compiled"),
      sourceSha256: manifest.sourceSha256,
    },
  });
  const original = await workbook(["Blue", "Valid"]);
  expect(
    validateWorkbook(parseWorkbook(original), mapping).issues.some(
      (i) => i.code === "MINITEMS",
    ),
  ).toBe(true);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(original as unknown as ExcelJS.Buffer);
  wb.worksheets[0].addRow(["Green", "Other"]);
  expect(
    validateWorkbook(
      parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer())),
      mapping,
    ).issues,
  ).toEqual([]);
  wb.worksheets[0].addRow(["Blue", "Valid"]);
  const issues = validateWorkbook(
    parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer())),
    mapping,
  ).issues;
  expect(issues.some((i) => i.code === "MAXITEMS")).toBe(true);
  expect(issues.some((i) => i.code === "UNIQUEITEMS")).toBe(true);
});
it("refuses references whose meaning would change under category specialization", async () => {
  const dir = mkdtempSync(join(tmpdir(), "feedfix-specialized-ref-"));
  const modified = {
    ...source,
    definitions: {
      ...source.definitions,
      unsafe: { $ref: "#/properties/MPItem/items/properties/Visible" },
    },
  };
  const input = join(dir, "source.json");
  writeFileSync(input, JSON.stringify(modified));
  const manifest = await compile(input, join(dir, "compiled"));
  expect(() =>
    officialRuntime({
      ...schema,
      compiled: {
        ...schema.compiled!,
        directory: join(dir, "compiled"),
        sourceSha256: manifest.sourceSha256,
      },
    }),
  ).toThrow(/specialized/);
});
it("rejects nonzero values that underflow to zero", async () => {
  const { decodeCell } = await import("../src/engine/compiled-runtime");
  expect(() =>
    decodeCell("[1e-400]", { column: "n", encoding: "json" }),
  ).toThrow(/precision/);
  expect(() =>
    decodeCell("0." + "0".repeat(399) + "1", {
      column: "n",
      encoding: "number",
    }),
  ).toThrow(/precision/);
});
