import { validateOfficial } from "./validate-official";
import { createHash } from "node:crypto";
import type {
  FeedIssue,
  MarketplaceSchema,
  ParsedWorkbook,
  ParsedSheet,
} from "./model";
import { rules } from "./rules";
const issueId = (parts: unknown[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
export class UnsupportedTemplateError extends Error {}
export function matchTemplate(
  workbook: ParsedWorkbook,
  schema: MarketplaceSchema,
) {
  const sheet = workbook.sheets.find((s) => s.name === schema.sheet);
  if (
    !sheet ||
    sheet.cells.get(schema.marker.cell)?.value !== schema.marker.value
  )
    throw new UnsupportedTemplateError(
      "This file doesn't appear to be a supported Walmart item setup workbook. This template version isn't supported yet.",
    );
  const columns = new Map<string, string>();
  for (const c of sheet.cells.values())
    if (Number(c.address.match(/\d+$/)![0]) === schema.headerRow) {
      if (columns.has(c.value))
        throw new UnsupportedTemplateError(
          "Duplicate column headers make this template ambiguous.",
        );
      columns.set(c.value, c.address.replace(/\d+$/, ""));
    }
  for (const f of schema.fields)
    if (!columns.has(f.column))
      throw new UnsupportedTemplateError(
        `This template is missing the declared ${f.column} column. Upload the original supported template.`,
      );
  return { sheet, columns };
}
export function table(workbook: ParsedWorkbook, schema: MarketplaceSchema) {
  const { sheet, columns } = matchTemplate(workbook, schema);
  const rowSet = new Set<number>();
  for (const c of sheet.cells.values()) {
    const row = Number(c.address.match(/\d+$/)![0]);
    if (row > schema.headerRow && c.value !== "") rowSet.add(row);
  }
  const rows = [...rowSet].sort((a, b) => a - b);
  if (rows.length > 10000)
    throw new Error(
      "This file exceeds the 10,000-item limit. Split it into smaller files.",
    );
  if (!rows.length)
    throw new Error("No items found. Add item rows to the supported template.");
  return { sheet, columns, rows };
}
export function valueAt(
  sheet: ParsedSheet,
  columns: Map<string, string>,
  column: string,
  row: number,
) {
  return sheet.cells.get(`${columns.get(column)}${row}`)?.value ?? "";
}
export function validateWorkbook(
  workbook: ParsedWorkbook,
  schema: MarketplaceSchema,
): { issues: FeedIssue[]; itemCount: number } {
  if (schema.compiled) return validateOfficial(workbook, schema);
  const { sheet, columns, rows } = table(workbook, schema);
  const issues: FeedIssue[] = [];
  const skuField = schema.fields.find((f) => f.type === "sku");
  const skus = new Map<string, number[]>();
  const add = (issue: Omit<FeedIssue, "id">) => {
    if (issues.length >= 10000)
      throw new Error(
        "Too many issues to safely process. Split this file into smaller batches.",
      );
    issues.push({
      ...issue,
      level:
        issue.severity === "error"
          ? "ERROR"
          : issue.severity === "warning"
            ? "WARNING"
            : "INFO",
      fixability:
        issue.code === "FORMULA"
          ? "UNSUPPORTED"
          : issue.resolution === "AUTO_FIX"
            ? "SAFE_AUTO_FIX"
            : "REVIEW_REQUIRED",
      id: issueId([issue.sheet, issue.row, issue.column, issue.code]),
    });
  };
  for (const row of rows) {
    const sku = skuField
      ? valueAt(sheet, columns, skuField.column, row)
      : undefined;
    if (sku?.trim())
      skus.set(sku.trim(), [...(skus.get(sku.trim()) ?? []), row]);
    for (const f of schema.fields) {
      const address = `${columns.get(f.column)}${row}`,
        cell = sheet.cells.get(address),
        v = cell?.value ?? "";
      if (cell?.formula) {
        add({
          sheet: sheet.name,
          row,
          sku,
          column: f.column,
          cell: address,
          code: "FORMULA",
          severity: "warning",
          resolution: "WARNING",
          title: "Formula is not validated",
          description:
            "The formula is preserved. Verify its result in Excel; FeedFix does not calculate formulas.",
          source: "FEEDFIX",
          confidence: 1,
          ruleId: "formula",
        });
        continue;
      }
      if (
        f.type === "number" &&
        cell &&
        ["s", "inlineStr"].includes(cell.kind) &&
        /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(v)
      )
        add({
          sheet: sheet.name,
          row,
          sku,
          column: f.column,
          cell: address,
          code: "NUMBER_AS_TEXT",
          severity: "error",
          resolution: "NEEDS_USER_INPUT",
          title: "Number is stored as text",
          description:
            "This field expects a numeric cell. Confirm the value and convert its cell type in Excel.",
          source: "FEEDFIX",
          confidence: 1,
          ruleId: "number-type",
        });
      const results = rules.flatMap((rule) =>
        rule.evaluate(v, f).map((result) => ({ ...result, ruleId: rule.id })),
      );
      // One cell is fixed only when every diagnostic can be satisfied by one candidate.
      const candidates = results
        .filter((r) => r.resolution === "AUTO_FIX")
        .map((r) => r.proposedValue!);
      const candidate = candidates.find((c) =>
        rules.every((rule) => rule.evaluate(c, f).length === 0),
      );
      let proposed = false;
      for (const result of results) {
        if (
          candidate !== undefined &&
          cell?.safe &&
          result.resolution !== "AUTO_FIX"
        )
          continue;
        let resolution = result.resolution;
        if (
          resolution === "AUTO_FIX" &&
          (!cell?.safe || candidate === undefined)
        )
          resolution = "NEEDS_USER_INPUT";
        if (resolution === "AUTO_FIX" && proposed) continue;
        if (resolution === "AUTO_FIX") proposed = true;
        add({
          ...result,
          resolution,
          proposedValue: resolution === "AUTO_FIX" ? candidate : undefined,
          description:
            result.description +
            (result.resolution === "AUTO_FIX" && resolution !== "AUTO_FIX"
              ? " Other problems or cell structure prevent a safe automatic change."
              : ""),
          sheet: sheet.name,
          row,
          sku,
          column: f.column,
          cell: address,
          severity: resolution === "WARNING" ? "warning" : "error",
          originalValue: v,
          source: "FEEDFIX",
          confidence: resolution === "AUTO_FIX" ? 1 : 0.99,
        });
      }
    }
  }
  if (skuField)
    for (const [sku, duplicates] of skus)
      if (duplicates.length > 1)
        for (const row of duplicates)
          add({
            sheet: sheet.name,
            row,
            sku,
            column: skuField.column,
            code: "DUPLICATE_SKU",
            severity: "error",
            resolution: "NEEDS_USER_INPUT",
            title: "Duplicate SKU",
            description:
              "This SKU occurs more than once, including surrounding-whitespace variants. Resolve the identity yourself.",
            source: "FEEDFIX",
            confidence: 1,
            ruleId: "duplicate-sku",
          });
  if (schema.variants) {
    const { groupColumn, consistentColumns } = schema.variants;
    const groups = new Map<string, number[]>();
    for (const row of rows) {
      const g = valueAt(sheet, columns, groupColumn, row);
      if (g) groups.set(g, [...(groups.get(g) ?? []), row]);
    }
    for (const groupRows of groups.values())
      for (const col of consistentColumns)
        if (
          new Set(groupRows.map((r) => valueAt(sheet, columns, col, r))).size >
          1
        )
          for (const row of groupRows)
            add({
              sheet: sheet.name,
              row,
              column: col,
              code: "VARIANT_INCONSISTENT",
              severity: "warning",
              resolution: "WARNING",
              title: "Variant group has inconsistent values",
              description:
                "The schema expects this field to agree within the group. Review the family; no automatic regrouping is performed.",
              source: "FEEDFIX",
              confidence: 1,
              ruleId: "variants",
            });
  }
  return { issues, itemCount: rows.length };
}
