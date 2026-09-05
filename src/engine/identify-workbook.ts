import { createHash } from "node:crypto";
import type { ParsedWorkbook } from "./model";
/** Read-only structural identification, never a mapping or authenticity decision. */
export function identifyWalmartWorkbook(workbook: ParsedWorkbook) {
  const definitions = workbook.sheets.find(
    (s) => s.name === "Data Definitions",
  );
  if (
    definitions?.cells.get("A1")?.value !== "Attribute Name" ||
    definitions.cells.get("B1")?.value !== "Definitions" ||
    definitions.cells.get("C1")?.value !== "Product Type"
  )
    return null;
  for (const sheet of workbook.sheets) {
    const marker = sheet.cells.get("A1")?.value || "";
    const parts = marker.split(",");
    const version = /^Version=(5\.0\.\d{8}-\d{2}_\d{2}_\d{2})$/.exec(
      parts[0],
    )?.[1];
    if (
      !version ||
      parts.length !== 8 ||
      parts[1] !== "MP_ITEM" ||
      parts[3] !== "en" ||
      parts[4] !== "external" ||
      parts[5] !== sheet.name
    )
      continue;
    const fields = [...sheet.cells.values()].filter(
      (c) => /^[A-Z]+5$/.test(c.address) && c.value,
    );
    if (
      fields.length > 512 ||
      fields.some(
        (c) => c.formula || !/^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(c.value),
      )
    )
      continue;
    if (
      !["sku", "specProductType", "productId", "productIdType"].every((name) =>
        fields.some((c) => c.value === name),
      )
    )
      continue;
    const metadata = workbook.sheets.find(
      (s) => s.name === ("Hidden_" + parts[2]).slice(0, 30),
    );
    if (
      !metadata ||
      !["hidden", "veryHidden"].includes(metadata.visibility || "") ||
      metadata.cells.get("A1")?.value !== "ColHeader" ||
      metadata.cells.get("A2")?.value !== "Attribute Name" ||
      metadata.cells.get("A3")?.value !== "Attribute XML Name"
    )
      continue;
    if (
      !fields.every((c) =>
        Boolean(sheet.cells.get(c.address.replace(/5$/, "4"))?.value),
      )
    )
      continue;
    // Only header structure (never rows, filenames or worksheet labels) contributes.
    const templateKey = createHash("sha256")
      .update(
        JSON.stringify({
          version,
          fields: fields
            .map((c) => [c.address, c.value])
            .sort((a, b) => a[0].localeCompare(b[0], "en")),
        }),
      )
      .digest("hex");
    return { declaredVersion: version, templateKey };
  }
  return null;
}
