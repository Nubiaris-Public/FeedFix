import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import AdmZip from "adm-zip";
import ExcelJS from "exceljs";
import { rules, checkDigit } from "../src/engine/rules";
import type { FieldDefinition } from "../src/engine/model";
import { parseWorkbook } from "../src/engine/workbook";
import { fixtureSchema } from "../src/engine/schema";
import { validateWorkbook } from "../src/engine/validate";
import { buildFixPlan, applyApprovedAutomaticFixes } from "../src/engine/fix";
import {
  correlate,
  processingReportParser,
} from "../src/engine/processing-report";
const fixture = (name: string) =>
  readFileSync(`tests/fixtures/walmart/${name}.xlsx`);
const evaluate = (v: string, f: FieldDefinition) =>
  rules.flatMap((r) => r.evaluate(v, f));
describe("deterministic rule matrix", () => {
  const cases: [
    string,
    FieldDefinition,
    string,
    string,
    string,
    string | undefined,
  ][] = [
    [
      "GTIN digits",
      { column: "id", type: "gtin" },
      "036000291452",
      "036A00291452",
      "GTIN_DIGITS",
      undefined,
    ],
    [
      "GTIN length",
      { column: "id", type: "gtin" },
      "036000291452",
      "123",
      "GTIN_LENGTH",
      undefined,
    ],
    [
      "GTIN checksum",
      { column: "id", type: "gtin" },
      "036000291452",
      "036000291453",
      "GTIN_CHECK_DIGIT",
      undefined,
    ],
    [
      "trim",
      { column: "name", type: "string", normalizeWhitespace: true },
      "Cup",
      " Cup ",
      "WHITESPACE",
      "Cup",
    ],
    [
      "controls",
      { column: "name", type: "string" },
      "Cup",
      "Cu\x07p",
      "CONTROL",
      undefined,
    ],
    [
      "length",
      { column: "name", type: "string", maxLength: 3 },
      "Cup",
      "Cups",
      "MAX_LENGTH",
      undefined,
    ],
    [
      "enum",
      { column: "enabled", enumValues: ["Yes", "No"] },
      "Yes",
      " yes ",
      "ENUM_NORMALIZE",
      "Yes",
    ],
    [
      "unknown enum",
      { column: "enabled", enumValues: ["Yes", "No"] },
      "No",
      "Perhaps",
      "ENUM_INVALID",
      undefined,
    ],
    [
      "url protocol",
      { column: "url", type: "url" },
      "https://example.com/a",
      "example.com/a",
      "URL_PROTOCOL",
      undefined,
    ],
    [
      "url spaces",
      { column: "url", type: "url" },
      "https://example.com/a",
      "https://example.com/a b",
      "URL_INVALID",
      undefined,
    ],
    [
      "number",
      { column: "price", type: "number" },
      "1.50",
      "1,50",
      "NUMBER_FORMAT",
      undefined,
    ],
    [
      "bound",
      {
        column: "price",
        type: "number",
        constraints: [{ kind: "min", value: 0 }],
      },
      "1",
      "-1",
      "NUMBER_BOUND",
      undefined,
    ],
    [
      "required",
      { column: "name", required: true },
      "Cup",
      " ",
      "REQUIRED",
      undefined,
    ],
    [
      "sku whitespace",
      { column: "sku", type: "sku" },
      "SKU",
      " SKU ",
      "WHITESPACE",
      undefined,
    ],
    [
      "boolean",
      { column: "flag", type: "boolean" },
      "true",
      "maybe",
      "BOOLEAN",
      undefined,
    ],
  ];
  it.each(cases)("%s", (name, field, valid, invalid, code, fix) => {
    expect(evaluate(valid, field)).toEqual([]);
    const issue = evaluate(invalid, field).find((i) => i.code === code);
    expect(issue).toBeDefined();
    expect(issue?.proposedValue).toBe(fix);
    expect(issue?.resolution).toBe(fix ? "AUTO_FIX" : "NEEDS_USER_INPUT");
  });
  it("known check digit vectors", () => {
    expect(checkDigit("03600029145")).toBe("2");
    expect(checkDigit("01234567890")).toBe("5");
  });
});
describe("workbook validation and surgical fixes", () => {
  it("valid file has no issues", () =>
    expect(
      validateWorkbook(parseWorkbook(fixture("valid")), fixtureSchema).issues,
    ).toEqual([]));
  it("detects duplicate SKUs without inventing a replacement", () => {
    const issues = validateWorkbook(
      parseWorkbook(fixture("duplicate-sku")),
      fixtureSchema,
    ).issues;
    expect(issues.filter((i) => i.code === "DUPLICATE_SKU")).toHaveLength(2);
    expect(buildFixPlan(issues)).toEqual([]);
  });
  it("preserves all untouched ZIP members and workbook semantics", async () => {
    const original = fixture("multiple-errors"),
      parsed = parseWorkbook(original),
      { issues } = validateWorkbook(parsed, fixtureSchema),
      plan = buildFixPlan(issues);
    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.cell)).toEqual(["C3", "F3"]);
    const out = applyApprovedAutomaticFixes(parsed, plan);
    const a = new AdmZip(original),
      b = new AdmZip(out);
    expect(b.getEntries().map((e) => e.entryName)).toEqual(
      a.getEntries().map((e) => e.entryName),
    );
    for (const e of a.getEntries())
      if (e.entryName !== parsed.sheets[0].path)
        expect(b.readFile(e.entryName)).toEqual(e.getData());
    const remaining = validateWorkbook(
      parseWorkbook(out),
      fixtureSchema,
    ).issues;
    expect(remaining).toHaveLength(3);
    expect(parsed.sheets[0].cells.get("C3")?.value).toBe(
      " Fictional blue cup ",
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(out as unknown as ExcelJS.Buffer);
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      "Synthetic Items",
      "Instructions",
    ]);
    expect(wb.worksheets[0].getCell("C3").value).toBe("Fictional blue cup");
    expect(wb.worksheets[0].getCell("F3").value).toBe("Yes");
    expect(wb.worksheets[1].getCell("B2").formula).toBe("SUM(1,2)");
    expect(wb.worksheets[0].getCell("E3").numFmt).toBe("0.00");
    expect(wb.worksheets[0].getRow(2).font.bold).toBe(true);
    expect(wb.worksheets[0].getCell("F3").dataValidation.type).toBe("list");
    expect(() =>
      applyApprovedAutomaticFixes(parsed, [{ ...plan[0], before: "wrong" }]),
    ).toThrow();
    expect(() =>
      buildFixPlan([
        ...issues,
        issues.find((i) => i.resolution === "AUTO_FIX")!,
      ]),
    ).toThrow();
  });
  it("rejects unknown template", () =>
    expect(() =>
      validateWorkbook(parseWorkbook(fixture("valid")), {
        ...fixtureSchema,
        version: "other",
        marker: { cell: "A1", value: "different" },
      }),
    ).toThrow(/supported/));
  it("correlates external errors without claiming they are fixed", () => {
    const w = parseWorkbook(fixture("multiple-errors"));
    const local = validateWorkbook(w, fixtureSchema).issues;
    const external = processingReportParser.parse(
      readFileSync("tests/fixtures/walmart/processing-report.csv"),
      "csv",
      fixtureSchema,
    );
    const issues = correlate(local, external, w, fixtureSchema);
    expect(
      issues.some(
        (i) => i.source === "BOTH" && i.resolution === "WALMART_SUPPORT",
      ),
    ).toBe(true);
  });
  it("refuses malformed and unsafe packages", () => {
    expect(() => parseWorkbook(Buffer.from("not xlsx"))).toThrow();
    const z = new AdmZip(fixture("valid"));
    z.addFile("xl/externalLinks/externalLink1.xml", Buffer.from("<x/>"));
    expect(() => parseWorkbook(z.toBuffer())).toThrow(/external/i);
  });
});
