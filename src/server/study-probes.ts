import AdmZip from "adm-zip";
import { parseWorkbook } from "../engine/workbook";
import { validateWorkbook } from "../engine/validate";
import { fixtureSchema } from "../engine/schema";
import { applyApprovedAutomaticFixes, buildFixPlan } from "../engine/fix";
import { verifyWorkbookIntegrity } from "../engine/integrity";

export const probeFeatures = [
  "baseline",
  "hiddenSheets",
  "formulas",
  "validations",
  "merges",
  "tables",
  "definedNames",
] as const;
export type ProbeFeature = (typeof probeFeatures)[number];
const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relns =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageNs =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const mapping = {
  ...fixtureSchema,
  sheet: "Synthetic Items",
  fields: [
    {
      column: "Title",
      type: "string" as const,
      required: true,
      normalizeWhitespace: true,
    },
    { column: "Color", type: "string" as const, enumValues: ["Red", "Blue"] },
  ],
  variants: undefined,
};
const cell = (address: string, value: string) =>
  `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${value}</t></is></c>`;
/** Entire fixture comes from fixed code constants. No uploaded strings or bytes. */
export function syntheticStudyFixture(feature: ProbeFeature): Buffer {
  const zip = new AdmZip();
  const add = (path: string, xml: string) => {
    zip.addFile(path, Buffer.from(xml));
    zip.getEntry(path)!.header.time = new Date(2020, 0, 1);
  };
  add(
    "[Content_Types].xml",
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>${feature === "hiddenSheets" ? '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' : ""}${feature === "tables" ? '<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>' : ""}</Types>`,
  );
  add(
    "_rels/.rels",
    `<Relationships xmlns="${packageNs}"><Relationship Id="rId1" Type="${relns}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  add(
    "xl/workbook.xml",
    `<workbook xmlns="${ns}" xmlns:r="${relns}"><sheets><sheet name="Synthetic Items" sheetId="1" r:id="rId1"/>${feature === "hiddenSheets" ? '<sheet name="Synthetic Hidden" sheetId="2" state="hidden" r:id="rId2"/>' : ""}</sheets>${feature === "definedNames" ? "<definedNames><definedName name=\"SyntheticList\">'Synthetic Items'!$A$3</definedName></definedNames>" : ""}</workbook>`,
  );
  add(
    "xl/_rels/workbook.xml.rels",
    `<Relationships xmlns="${packageNs}"><Relationship Id="rId1" Type="${relns}/worksheet" Target="worksheets/sheet1.xml"/>${feature === "hiddenSheets" ? `<Relationship Id="rId2" Type="${relns}/worksheet" Target="worksheets/sheet2.xml"/>` : ""}</Relationships>`,
  );
  add(
    "xl/worksheets/sheet1.xml",
    `<worksheet xmlns="${ns}" xmlns:r="${relns}"><sheetData><row r="1">${cell("A1", mapping.marker.value)}</row><row r="2">${cell("A2", "Title")}${cell("B2", "Color")}</row><row r="3">${cell("A3", " Example ")}${cell("B3", "purple")}${feature === "formulas" ? '<c r="E3"><f>1+1</f><v>2</v></c>' : ""}</row></sheetData>${feature === "merges" ? '<mergeCells count="1"><mergeCell ref="D1:E1"/></mergeCells>' : ""}${feature === "validations" ? '<dataValidations count="1"><dataValidation type="list" sqref="B3"><formula1>"Red,Blue"</formula1></dataValidation></dataValidations>' : ""}${feature === "tables" ? '<tableParts count="1"><tablePart r:id="rId1"/></tableParts>' : ""}</worksheet>`,
  );
  if (feature === "hiddenSheets")
    add(
      "xl/worksheets/sheet2.xml",
      `<worksheet xmlns="${ns}"><sheetData><row r="1">${cell("A1", "Synthetic list")}</row></sheetData></worksheet>`,
    );
  if (feature === "tables") {
    add(
      "xl/worksheets/_rels/sheet1.xml.rels",
      `<Relationships xmlns="${packageNs}"><Relationship Id="rId1" Type="${relns}/table" Target="../tables/table1.xml"/></Relationships>`,
    );
    add(
      "xl/tables/table1.xml",
      `<table xmlns="${ns}" id="1" name="SyntheticTable" displayName="SyntheticTable" ref="A2:B3" totalsRowShown="0"><autoFilter ref="A2:B3"/><tableColumns count="2"><tableColumn id="1" name="Title"/><tableColumn id="2" name="Color"/></tableColumns></table>`,
    );
  }
  return zip.toBuffer();
}
export function runStudyProbe(
  feature: ProbeFeature,
  repair = applyApprovedAutomaticFixes,
) {
  let stage = "PARSE";
  try {
    const original = syntheticStudyFixture(feature);
    const workbook = parseWorkbook(original);
    stage = "VALIDATE";
    const findings = validateWorkbook(workbook, mapping);
    const plan = buildFixPlan(findings.issues);
    if (
      plan.length !== 1 ||
      plan[0].cell !== "A3" ||
      plan[0].after !== "Example" ||
      !findings.issues.some(
        (i) => i.cell === "B3" && i.resolution === "NEEDS_USER_INPUT",
      )
    )
      throw Error("Unexpected findings");
    stage = "REPAIR";
    const output = repair(workbook, plan);
    stage = "INTEGRITY";
    verifyWorkbookIntegrity(original, output, plan);
    stage = "REVALIDATE";
    const repaired = parseWorkbook(output);
    const remaining = validateWorkbook(repaired, mapping);
    if (
      remaining.issues.length !== 1 ||
      remaining.issues[0].cell !== "B3" ||
      repaired.sheets[0].cells.get("B3")?.value !== "purple"
    )
      throw Error("Unexpected remaining findings");
    stage = "IDEMPOTENCY";
    const secondPlan = buildFixPlan(remaining.issues);
    if (secondPlan.length || !repair(repaired, secondPlan).equals(output))
      throw Error("Non-idempotent repair");
    return {
      feature,
      origin: "SYNTHETIC" as const,
      status: "PASS" as const,
      stage: "COMPLETE",
    };
  } catch {
    return {
      feature,
      origin: "SYNTHETIC" as const,
      status: "FAIL" as const,
      stage,
    };
  }
}
export function runStudyProbes(signals: Record<string, number>) {
  return probeFeatures
    .filter((f) => f === "baseline" || signals[f] > 0)
    .map((f) => runStudyProbe(f));
}
