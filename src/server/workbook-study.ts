import { createHash } from "node:crypto";
import { checkedZip, list, xmlParse } from "../engine/workbook";
import type { ParsedWorkbook } from "../engine/model";

/** Descriptive evidence only: workbook markers are untrusted self-declarations. */
export function studyWorkbook(bytes: Buffer, workbook: ParsedWorkbook) {
  const zip = checkedZip(bytes);
  const book = xmlParse(zip.readAsText("xl/workbook.xml")).workbook;
  const sheetMetadata = list<Record<string, string>>(book.sheets?.sheet);
  const count = (value: unknown) => list(value).length;
  const clip = (value: string) => value.slice(0, 160);
  return {
    studyVersion: "1",
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    origin: "UNKNOWN",
    authenticity: "NOT_VERIFIED",
    schemaCompatibility: "NOT_EVALUATED",
    repairStatus: "NOT_ATTEMPTED",
    reviewRequired: [
      "Confirm download provenance independently of workbook metadata.",
      "Review column paths and declared version before binding a compiled schema.",
      "Verify repairs against the original package before enabling support.",
    ],
    definedNames: count(book.definedNames?.definedName),
    // Hashes form a baseline for later package-integrity comparisons, not a claim
    // that an untested repair preserves the workbook.
    packageMembers: zip.getEntries().map((entry) => ({
      name: entry.entryName,
      bytes: entry.header.size,
      sha256: createHash("sha256").update(entry.getData()).digest("hex"),
    })),
    sheets: workbook.sheets.map((sheet, index) => {
      const xml = xmlParse(sheet.xml).worksheet;
      const marker = sheet.cells.get("A1")?.value || "";
      const version = /^Version=(5\.0\.\d{8}-\d{2}_\d{2}_\d{2})(?:,|$)/.exec(
        marker,
      )?.[1];
      const candidate = Boolean(version && marker.split(",")[1] === "MP_ITEM");
      const columns = candidate
        ? [...sheet.cells.values()].filter(
            (cell) => /^[A-Z]+5$/.test(cell.address) && cell.value,
          )
        : [];
      const dataRows = new Set<number>();
      for (const cell of sheet.cells.values()) {
        const row = Number(cell.address.match(/\d+$/)?.[0]);
        if (candidate && row > 6 && (cell.value || cell.formula))
          dataRows.add(row);
      }
      return {
        name: sheet.name,
        order: index,
        visibility: sheetMetadata[index]?.["@_state"] || "visible",
        cells: sheet.cells.size,
        formulas: [...sheet.cells.values()].filter((cell) => cell.formula)
          .length,
        mergedRanges: count(xml.mergeCells?.mergeCell),
        dataValidations: count(xml.dataValidations?.dataValidation),
        tables: count(xml.tableParts?.tablePart),
        declaredSchemaVersion: version || null,
        layout: candidate ? "WALMART_MP_ITEM_CANDIDATE" : "UNKNOWN",
        candidateDataRows: candidate ? dataRows.size : null,
        candidateColumnCount: columns.length,
        columnsTruncated: columns.length > 512,
        candidateColumns: columns.slice(0, 512).map((cell) => ({
          column: cell.address.replace(/\d+$/, ""),
          declaredField: clip(cell.value),
          displayName: clip(
            sheet.cells.get(cell.address.replace(/5$/, "4"))?.value || "",
          ),
          truncated:
            cell.value.length > 160 ||
            (sheet.cells.get(cell.address.replace(/5$/, "4"))?.value.length ||
              0) > 160,
        })),
      };
    }),
  };
}
