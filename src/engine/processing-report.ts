import { parse } from "csv-parse/sync";
import type {
  ExternalIssue,
  FeedIssue,
  MarketplaceSchema,
  ParsedWorkbook,
} from "./model";
import { parseWorkbook } from "./workbook";
import { table, valueAt } from "./validate";
import { createHash } from "node:crypto";
export interface ProcessingReportParser {
  parse(
    buffer: Buffer,
    extension: "csv" | "xlsx",
    schema: MarketplaceSchema,
  ): ExternalIssue[];
}
export const processingReportParser: ProcessingReportParser = {
  parse(buffer, extension, schema) {
    const config = schema.report;
    if (!config)
      throw new Error(
        "Processing reports are not supported for this template yet. Analyze without the report.",
      );
    let records: Record<string, string>[];
    if (extension === "csv") {
      const rows = parse(buffer, {
        bom: true,
        skip_empty_lines: true,
        max_record_size: 100000,
      }) as string[][];
      const headers = rows[config.headerRow - 1];
      if (!headers || !headers.includes(config.columns.message))
        throw new Error(
          "This processing report layout is not supported. Use the declared report format.",
        );
      if (new Set(headers).size !== headers.length)
        throw new Error("Report headers are ambiguous.");
      records = rows
        .slice(config.headerRow)
        .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
    } else {
      const workbook = parseWorkbook(buffer),
        sheet = config.sheet
          ? workbook.sheets.find((s) => s.name === config.sheet)
          : workbook.sheets[0];
      if (!sheet) throw new Error("Report worksheet is missing.");
      const headers = [...sheet.cells.values()].filter(
        (c) => Number(c.address.match(/\d+$/)![0]) === config.headerRow,
      );
      if (!headers.some((c) => c.value === config.columns.message))
        throw new Error("This processing report layout is not supported.");
      const rows = new Set(
        [...sheet.cells.keys()]
          .map((a) => Number(a.match(/\d+$/)![0]))
          .filter((r) => r > config.headerRow),
      );
      records = [...rows].map((row) =>
        Object.fromEntries(
          headers.map((h) => [
            h.value,
            sheet.cells.get(h.address.replace(/\d+$/, String(row)))?.value ??
              "",
          ]),
        ),
      );
    }
    if (records.length > 10000)
      throw new Error("Processing report exceeds the 10,000-error limit.");
    return records
      .filter((r) => r[config.columns.message])
      .map((r) => {
        const get = (key: keyof typeof config.columns) =>
          config.columns[key]
            ? r[config.columns[key]!] || undefined
            : undefined;
        const row = get("row");
        if (row && !/^[1-9]\d*$/.test(row))
          throw new Error("Report row numbers must be positive integers.");
        return {
          message: get("message")!,
          sku: get("sku"),
          row: row ? Number(row) : undefined,
          column: get("column"),
          code: get("code"),
        };
      });
  },
};
export function correlate(
  issues: FeedIssue[],
  external: ExternalIssue[],
  workbook: ParsedWorkbook,
  schema: MarketplaceSchema,
): FeedIssue[] {
  const output = issues.map((i) => ({ ...i }));
  const { sheet, columns, rows } = table(workbook, schema),
    skuColumn = schema.fields.find((f) => f.type === "sku")?.column;
  external.forEach((e, index) => {
    const skuRows =
      e.sku && skuColumn
        ? rows.filter((r) => valueAt(sheet, columns, skuColumn, r) === e.sku)
        : [];
    const row =
      e.row && rows.includes(e.row) && (!e.sku || skuRows.includes(e.row))
        ? e.row
        : !e.row && skuRows.length === 1
          ? skuRows[0]
          : undefined;
    const matches =
      row && e.column
        ? output.filter(
            (i) =>
              i.source !== "WALMART" && i.row === row && i.column === e.column,
          )
        : [];
    // Correlation records the shared location, but never assumes an external rejection is fixed locally.
    matches.forEach((i) => (i.source = "BOTH"));
    output.push({
      id: createHash("sha256")
        .update(JSON.stringify([e, index]))
        .digest("hex")
        .slice(0, 24),
      sheet: sheet.name,
      row,
      sku: e.sku,
      column: e.column,
      code: e.code ?? "EXTERNAL",
      severity: "error",
      resolution:
        e.code && schema.report?.supportCodes.includes(e.code)
          ? "WALMART_SUPPORT"
          : "NEEDS_USER_INPUT",
      title: "Walmart processing report",
      description: e.message,
      source: matches.length ? "BOTH" : "WALMART",
      confidence: row ? 1 : 0.5,
    });
  });
  return output;
}
