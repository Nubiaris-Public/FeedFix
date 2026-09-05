import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import { fixtureSchema } from "../src/engine/schema";
const dir = "tests/fixtures/walmart";
await mkdir(dir, { recursive: true });
for (const name of [
  "valid",
  "invalid-gtin",
  "invalid-required",
  "invalid-enums",
  "duplicate-sku",
  "multiple-errors",
]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FeedFix synthetic fixtures";
  const sheet = wb.addWorksheet(fixtureSchema.sheet);
  sheet.addRow([fixtureSchema.marker.value]);
  sheet.addRow(fixtureSchema.fields.map((f) => f.column));
  sheet.addRow([
    "DEMO-001",
    "036000291452",
    "Fictional blue cup",
    "https://example.com/cup.png",
    4.99,
    "Yes",
    "DEMO-GROUP",
    "Fictional Brand",
  ]);
  sheet.addRow([
    "DEMO-002",
    "012345678905",
    "Fictional green cup",
    "https://example.com/green.png",
    5.99,
    "No",
    "DEMO-GROUP",
    "Fictional Brand",
  ]);
  sheet.getRow(2).font = { bold: true, color: { argb: "FF116044" } };
  sheet.getColumn(3).width = 34;
  sheet.getCell("E3").numFmt = "0.00";
  sheet.views = [{ state: "frozen", ySplit: 2 }];
  sheet.getCell("F3").dataValidation = { type: "list", formulae: ['"Yes,No"'] };
  const instructions = wb.addWorksheet("Instructions");
  instructions.getCell("A1").value =
    "Synthetic test workbook. Not an official Walmart template.";
  instructions.getCell("B2").value = { formula: "SUM(1,2)", result: 3 };
  if (name === "invalid-gtin") sheet.getCell("B3").value = "036000291453";
  if (name === "invalid-required") sheet.getCell("C3").value = "";
  if (name === "invalid-enums") sheet.getCell("F3").value = " yes ";
  if (name === "duplicate-sku") sheet.getCell("A4").value = "DEMO-001";
  if (name === "multiple-errors") {
    sheet.getCell("C3").value = " Fictional blue cup ";
    sheet.getCell("F3").value = " yes ";
    sheet.getCell("B4").value = "036000291453";
    sheet.getCell("D4").value = "example.com/green.png";
    sheet.getCell("E4").value = "1,50";
  }
  await wb.xlsx.writeFile(`${dir}/${name}.xlsx`);
}
await writeFile(
  `${dir}/processing-report.csv`,
  "sku,row,column,code,message\nDEMO-002,4,GTIN,SYNTHETIC_CATALOG_CONFLICT,Fictitious catalog conflict requiring Walmart support\n",
);
await writeFile(
  `${dir}/schema.synthetic.json`,
  JSON.stringify(fixtureSchema, null, 2),
);
