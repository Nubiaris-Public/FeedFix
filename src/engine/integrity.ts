import { checkedZip, parseWorkbook, xmlParse } from "./workbook";
import type { FixOperation } from "./model";

/** Every archive member and worksheet byte outside approved cell payloads must match. */
export function verifyWorkbookIntegrity(
  before: Buffer,
  after: Buffer,
  plan: FixOperation[],
) {
  const a = checkedZip(before),
    b = checkedZip(after);
  const names = a.getEntries().map((e) => e.entryName);
  if (
    JSON.stringify(names) !==
    JSON.stringify(b.getEntries().map((e) => e.entryName))
  )
    throw new Error("Workbook integrity: archive members or order changed");
  const original = parseWorkbook(before),
    repaired = parseWorkbook(after);
  const allowed = new Map<string, FixOperation[]>();
  const seen = new Set<string>();
  for (const op of plan) {
    const sheet = original.sheets.find((s) => s.name === op.sheet);
    if (!sheet || seen.has(op.sheet + "!" + op.cell))
      throw new Error("Workbook integrity: ambiguous change");
    seen.add(op.sheet + "!" + op.cell);
    allowed.set(sheet.path, [...(allowed.get(sheet.path) ?? []), op]);
  }
  for (const name of names) {
    const operations = allowed.get(name);
    const left = a.readFile(name),
      right = b.readFile(name);
    if (!operations) {
      if (!left?.equals(right ?? Buffer.alloc(0)))
        throw new Error("Workbook integrity: unexpected change to " + name);
      continue;
    }
    let originalXml = left!.toString(),
      repairedXml = right!.toString();
    for (const op of operations) {
      const old = original.sheets
        .find((s) => s.path === name)!
        .cells.get(op.cell);
      const cell = repaired.sheets
        .find((s) => s.path === name)
        ?.cells.get(op.cell);
      if (
        !old?.safe ||
        !cell?.safe ||
        old.value !== op.before ||
        cell.value !== op.after
      )
        throw new Error("Workbook integrity: changed value or unsafe cell");
      const attributes = (raw: string) =>
        Object.fromEntries(
          Object.entries(xmlParse(raw).c).filter(
            ([key]) => !["@_t", "v", "is"].includes(key),
          ),
        );
      if (
        JSON.stringify(attributes(old.raw)) !==
        JSON.stringify(attributes(cell.raw))
      )
        throw new Error("Workbook integrity: cell attributes changed");
      originalXml = originalXml.replace(
        old.raw,
        `<!--approved-value:${op.cell}-->`,
      );
      repairedXml = repairedXml.replace(
        cell.raw,
        `<!--approved-value:${op.cell}-->`,
      );
    }
    if (originalXml !== repairedXml)
      throw new Error("Workbook integrity: worksheet structure changed");
  }
  return {
    status: "PASS" as const,
    entries: names.length,
    changedCells: plan.length,
  };
}
