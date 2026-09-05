import { readFileSync, statSync } from "node:fs";
import { hydrateOfficialFields } from "./compiled-runtime";
import { marketplaceSchema, type MarketplaceSchema } from "./model";
export const fixtureSchema: MarketplaceSchema = {
  marketplace: "walmart",
  version: "SYNTHETIC-1",
  synthetic: true,
  origin: "SYNTHETIC",
  provenance: "FeedFix fictitious test data. NOT an official Walmart template.",
  sheet: "Synthetic Items",
  headerRow: 2,
  marker: {
    cell: "A1",
    value: "FEEDFIX SYNTHETIC FIXTURE — NOT A WALMART TEMPLATE",
  },
  fields: [
    { column: "SKU", type: "sku", required: true },
    { column: "GTIN", type: "gtin", required: true, normalizeWhitespace: true },
    {
      column: "Title",
      type: "string",
      required: true,
      maxLength: 80,
      normalizeWhitespace: true,
    },
    { column: "Image URL", type: "url", normalizeWhitespace: true },
    {
      column: "Price",
      type: "number",
      required: true,
      constraints: [{ kind: "min", value: 0 }],
    },
    { column: "Enabled", type: "boolean", enumValues: ["Yes", "No"] },
    { column: "Group", type: "string" },
    { column: "Brand", type: "string" },
  ],
  variants: { groupColumn: "Group", consistentColumns: ["Brand"] },
  report: {
    headerRow: 1,
    columns: {
      sku: "sku",
      row: "row",
      column: "column",
      code: "code",
      message: "message",
    },
    supportCodes: ["SYNTHETIC_CATALOG_CONFLICT"],
  },
};
export function getSchema(): MarketplaceSchema {
  if (process.env.SCHEMA_PATH) {
    if (statSync(process.env.SCHEMA_PATH).size > 1024 * 1024)
      throw new Error(
        "This schema path must point to a small reviewed workbook mapping, never the source JSON.",
      );
    const schema = marketplaceSchema.parse(
      JSON.parse(readFileSync(process.env.SCHEMA_PATH, "utf8")),
    );
    if (schema.compiled) return hydrateOfficialFields(schema);
    if (!schema.synthetic || schema.version !== fixtureSchema.version)
      throw new Error(
        "This workbook mapping must bind a compiled official schema.",
      );
    return { ...schema, origin: "SYNTHETIC" };
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_SYNTHETIC_FIXTURES !== "true"
  )
    throw new Error(
      "No reviewed template is configured yet. Please try again when template support is available.",
    );
  return fixtureSchema;
}
