import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import AdmZip from "adm-zip";
import ExcelJS from "exceljs";
import { parseWorkbook } from "../src/engine/workbook";
import { validateWorkbook } from "../src/engine/validate";
import { fixtureSchema } from "../src/engine/schema";
import { buildFixPlan } from "../src/engine/fix";
import {
  processingReportParser,
  correlate,
} from "../src/engine/processing-report";
const source = () => readFileSync("tests/fixtures/walmart/valid.xlsx");
async function modified(change: (w: ExcelJS.Workbook) => void) {
  const w = new ExcelJS.Workbook();
  await w.xlsx.load(source() as unknown as ExcelJS.Buffer);
  change(w);
  return parseWorkbook(Buffer.from(await w.xlsx.writeBuffer()));
}
it("does not fix GTIN whitespace when identifier is invalid", async () => {
  const w = await modified((w) => {
    w.worksheets[0].getCell("B3").value = " 036000291453 ";
  });
  const issues = validateWorkbook(w, fixtureSchema).issues;
  expect(issues.map((i) => i.code)).toEqual(["WHITESPACE", "GTIN_CHECK_DIGIT"]);
  expect(buildFixPlan(issues)).toEqual([]);
});
it("preserves identity leading zeros when trimming an otherwise valid GTIN", async () => {
  const w = await modified((w) => {
    w.worksheets[0].getCell("B3").value = " 036000291452 ";
  });
  expect(buildFixPlan(validateWorkbook(w, fixtureSchema).issues)[0].after).toBe(
    "036000291452",
  );
});
it("never fixes formulas, merged cells or rich text", async () => {
  const w = await modified((w) => {
    const s = w.worksheets[0];
    s.getCell("C3").value = { formula: '" Cup "', result: " Cup " };
    s.getCell("F3").value = { richText: [{ text: " yes " }] };
    s.mergeCells("C4:D4");
    s.getCell("C4").value = " Cup ";
  });
  const issues = validateWorkbook(w, fixtureSchema).issues;
  expect(issues.some((i) => i.code === "FORMULA")).toBe(true);
  expect(buildFixPlan(issues)).toEqual([]);
});
it("detects numeric text and inconsistent variants", async () => {
  const w = await modified((w) => {
    w.worksheets[0].getCell("E3").value = "4.99";
    w.worksheets[0].getCell("H4").value = "Other Brand";
  });
  const issues = validateWorkbook(w, fixtureSchema).issues;
  expect(issues.some((i) => i.code === "NUMBER_AS_TEXT")).toBe(true);
  expect(issues.filter((i) => i.code === "VARIANT_INCONSISTENT")).toHaveLength(
    2,
  );
});
it("rejects XML entities and high compression ratio before parsing", () => {
  const z = new AdmZip(source());
  z.addFile(
    "xl/attack.xml",
    Buffer.from('<!DOCTYPE x [<!ENTITY e "text">]><x>&e;</x>'),
  );
  expect(() => parseWorkbook(z.toBuffer())).toThrow(/XML/);
  const bomb = new AdmZip(source());
  bomb.addFile(
    "xl/bomb.xml",
    Buffer.from("<x>" + "x".repeat(2 * 1024 * 1024) + "</x>"),
  );
  expect(() => parseWorkbook(bomb.toBuffer())).toThrow(/decompression/);
});
it("rejects archive traversal, mismatched sizes, macros and dangerous formulas", async () => {
  const traversal = new AdmZip(source());
  traversal.addFile("aa/evil.xml", Buffer.from("<x/>"));
  const bytes = traversal.toBuffer();
  for (
    let at = bytes.indexOf("aa/evil.xml");
    at !== -1;
    at = bytes.indexOf("aa/evil.xml")
  )
    bytes.write("../evil.xml", at);
  expect(() => parseWorkbook(bytes)).toThrow(/paths/);
  const macro = new AdmZip(source());
  macro.addFile("xl/vbaProject.bin", Buffer.from("macro"));
  expect(() => parseWorkbook(macro.toBuffer())).toThrow(/Macros/);
  await expect(
    modified((w) => {
      w.worksheets[0].getCell("C3").value = {
        formula: 'WEBSERVICE("https://example.com")',
      };
    }),
  ).rejects.toThrow(/unsafe formulas/);
});
it("quoted CSV and XLSX reports use the declared mapping; duplicate SKU is unmatched", async () => {
  const csv = Buffer.from(
    'sku,row,column,code,message\nDEMO-001,,Title,X,"Contains, a comma"\n',
  );
  expect(
    processingReportParser.parse(csv, "csv", fixtureSchema)[0].message,
  ).toBe("Contains, a comma");
  const report = new ExcelJS.Workbook();
  const sheet = report.addWorksheet("Report");
  sheet.addRow(["sku", "row", "column", "code", "message"]);
  sheet.addRow(["DEMO-001", 3, "Title", "X", "Example problem"]);
  expect(
    processingReportParser.parse(
      Buffer.from(await report.xlsx.writeBuffer()),
      "xlsx",
      fixtureSchema,
    )[0].row,
  ).toBe(3);
  const w = parseWorkbook(
    readFileSync("tests/fixtures/walmart/duplicate-sku.xlsx"),
  );
  const result = correlate(
    [],
    processingReportParser.parse(csv, "csv", fixtureSchema),
    w,
    fixtureSchema,
  );
  expect(result[0].row).toBeUndefined();
  expect(() =>
    processingReportParser.parse(
      Buffer.from("wrong,headers\na,b"),
      "csv",
      fixtureSchema,
    ),
  ).toThrow(/layout/);
});
