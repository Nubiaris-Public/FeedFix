import { createHash } from "node:crypto";
import type { FeedIssue, MarketplaceSchema, ParsedWorkbook } from "./model";
import { table } from "./validate";
import {
  officialRuntime,
  decodeCell,
  setCanonical,
  errorsFor,
} from "./compiled-runtime";
const escape = (s: string) => s.replace(/~/g, "~0").replace(/\//g, "~1");
export function validateOfficial(
  workbook: ParsedWorkbook,
  schema: MarketplaceSchema,
) {
  const runtime = officialRuntime(schema);
  const { sheet, columns, rows } = table(workbook, schema);
  const issues: FeedIssue[] = [];
  const add = (issue: Omit<FeedIssue, "id">) => {
    if (issues.length >= 10000)
      throw new Error("Too many issues to safely process");
    issues.push({
      ...issue,
      id: createHash("sha256")
        .update(
          JSON.stringify([
            issue.sheet,
            issue.row,
            issue.cell,
            issue.code,
            issue.canonicalPath,
            issue.schemaPath,
          ]),
        )
        .digest("hex")
        .slice(0, 24),
    });
  };
  const items: Record<string, unknown>[] = [];
  const uncertainRows = new Set<number>();
  for (const row of rows) {
    const item: Record<string, unknown> = {};
    // Explicitly bind this adapter to one category, even if all category cells are empty.
    item.Visible = { [schema.compiled!.productType]: {} };
    let uncertain = false;
    for (const f of schema.fields) {
      const address = columns.get(f.column)! + row;
      const cell = sheet.cells.get(address);
      if (!cell) continue;
      const base = {
        sheet: sheet.name,
        row,
        column: f.column,
        cell: address,
        canonicalPath: f.canonicalPath,
        source: "FEEDFIX" as const,
        confidence: 1,
      };
      if (cell.formula) {
        uncertain = true;
        add({
          ...base,
          code: "FORMULA",
          severity: "warning",
          level: "WARNING",
          resolution: "WARNING",
          fixability: "UNSUPPORTED",
          title: "Formula is not validated",
          description:
            "Formula preserved; its value is not calculated or trusted.",
        });
        continue;
      }
      if (cell.value === "") continue;
      try {
        setCanonical(item, f.canonicalPath!, decodeCell(cell.value, f));
      } catch {
        uncertain = true;
        add({
          ...base,
          code: "CELL_ENCODING",
          severity: "error",
          level: "ERROR",
          resolution: "NEEDS_USER_INPUT",
          fixability: "REVIEW_REQUIRED",
          title: "Cell encoding is ambiguous",
          description:
            "Use the declared field encoding; arrays and objects require explicit JSON in this adapter.",
          originalValue: cell.value,
        });
      }
    }
    items.push(item);
    if (uncertain) uncertainRows.add(row);
  }
  const errors = errorsFor(runtime, schema, items);
  const errorsByRow = new Map<number, typeof errors>();
  for (const error of errors) {
    const match = /^\/MPItem\/(\d+)(?:\/|$)/.exec(error.instancePath);
    const index = match ? Number(match[1]) : 0;
    const bucket = errorsByRow.get(index) ?? [];
    bucket.push(error);
    errorsByRow.set(index, bucket);
  }
  // Candidate exploration must remain bounded even for large invalid uploads.
  let candidatesLeft = Math.min(
    20,
    Math.floor(200000 / Math.max(1, items.length * schema.fields.length)),
  );
  for (const [index, row] of rows.entries()) {
    const rowErrors = errorsByRow.get(index) ?? [];
    // Candidates are checked against the complete feed, including array-level and
    // cross-item conditions. Any uncertainty or remaining error prevents auto-fix.
    const proposed = new Map<string, string>();
    if (!uncertainRows.size && rowErrors.length && candidatesLeft > 0) {
      for (const f of schema.fields) {
        const cell = sheet.cells.get(columns.get(f.column)! + row);
        const values = f.validation?.enum;
        if (
          !cell?.safe ||
          f.encoding !== "text" ||
          !Array.isArray(values) ||
          values.includes(cell.value)
        )
          continue;
        const matches = values.filter(
          (v) =>
            typeof v === "string" &&
            v.toLowerCase() === cell.value.trim().toLowerCase(),
        );
        if (matches.length !== 1) continue;
        if (candidatesLeft-- <= 0) break;
        const candidate = structuredClone(items);
        const parts = f
          .canonicalPath!.slice(1)
          .split("/")
          .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
        let parent = candidate[index];
        for (const key of parts.slice(0, -1))
          parent = parent[key] as Record<string, unknown>;
        parent[parts.at(-1)!] = matches[0];
        if (errorsFor(runtime, schema, candidate).length === 0)
          proposed.set(f.canonicalPath!, matches[0]);
      }
    }
    const emitted = new Set<string>();
    for (const error of rowErrors) {
      const pointer =
        error.instancePath.replace(/^\/MPItem\/\d+(?=\/|$)/, "") +
        (error.keyword === "required"
          ? "/" + escape(String(error.params.missingProperty))
          : "");
      const field = schema.fields.find(
        (f) =>
          f.canonicalPath === pointer ||
          pointer.startsWith(f.canonicalPath! + "/"),
      );
      const value = field ? proposed.get(field.canonicalPath!) : undefined;
      if (value !== undefined && emitted.has(field!.canonicalPath!)) continue;
      if (value !== undefined) emitted.add(field!.canonicalPath!);
      const cell = field ? columns.get(field.column)! + row : undefined;
      add({
        sheet: sheet.name,
        row,
        column: field?.column,
        cell,
        code:
          value !== undefined
            ? "ENUM_NORMALIZE"
            : error.keyword === "required"
              ? "REQUIRED"
              : error.keyword.toUpperCase(),
        severity: "error",
        level: "ERROR",
        resolution: value !== undefined ? "AUTO_FIX" : "NEEDS_USER_INPUT",
        fixability: value !== undefined ? "SAFE_AUTO_FIX" : "REVIEW_REQUIRED",
        title:
          value !== undefined
            ? "Unambiguous enum formatting correction"
            : "Official schema constraint failed",
        description:
          `${error.message ?? error.keyword} (${error.schemaPath}).` +
          (field ? "" : " No mapped column supplies this field."),
        canonicalPath: pointer,
        schemaPath: error.schemaPath,
        originalValue: cell ? sheet.cells.get(cell)?.value : undefined,
        proposedValue: value,
        source: "FEEDFIX",
        confidence: 1,
        ruleId: "official-" + error.keyword,
      });
    }
  }
  return { issues, itemCount: rows.length };
}
