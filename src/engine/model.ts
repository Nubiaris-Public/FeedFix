import { z } from "zod";
export const evidenceOrigin = z.enum([
  "SYNTHETIC",
  "WALMART_LEGACY_REAL",
  "WALMART_CURRENT_SUPPORTED",
  "UNKNOWN",
]);
export type EvidenceOrigin = z.infer<typeof evidenceOrigin>;
export const fieldDefinition = z.object({
  column: z.string().min(1),
  canonicalPath: z.string().startsWith("/").optional(),
  schemaPath: z.string().startsWith("#/").optional(),
  displayName: z.string().optional(),
  encoding: z.enum(["text", "number", "boolean", "json"]).optional(),
  validation: z.record(z.string(), z.unknown()).optional(),
  minLength: z.number().int().nonnegative().optional(),
  pattern: z.string().optional(),
  type: z
    .enum(["string", "number", "boolean", "url", "gtin", "sku"])
    .optional(),
  required: z.boolean().optional(),
  maxLength: z.number().int().positive().optional(),
  enumValues: z.array(z.string()).min(1).optional(),
  normalizeWhitespace: z.boolean().optional(),
  constraints: z
    .array(
      z.object({
        kind: z.enum(["min", "max", "integer"]),
        value: z.number().optional(),
      }),
    )
    .optional(),
});
export const marketplaceSchema = z.object({
  marketplace: z.literal("walmart"),
  version: z.string(),
  synthetic: z.boolean(),
  provenance: z.string(),
  origin: evidenceOrigin.optional(),
  compiled: z
    .object({
      directory: z.string().min(1),
      sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
      productType: z.string().min(1),
      feedHeader: z.record(z.string(), z.unknown()),
    })
    .optional(),
  goldenEvidencePath: z.string().optional(),
  sheet: z.string(),
  headerRow: z.number().int().positive(),
  marker: z.object({
    cell: z.string().regex(/^[A-Z]+[1-9]\d*$/),
    value: z.string(),
  }),
  fields: z.array(fieldDefinition).min(1),
  variants: z
    .object({ groupColumn: z.string(), consistentColumns: z.array(z.string()) })
    .optional(),
  report: z
    .object({
      sheet: z.string().optional(),
      headerRow: z.number().int().positive().default(1),
      columns: z.object({
        message: z.string(),
        sku: z.string().optional(),
        row: z.string().optional(),
        column: z.string().optional(),
        code: z.string().optional(),
      }),
      supportCodes: z.array(z.string()).default([]),
    })
    .optional(),
});
export type MarketplaceSchema = z.infer<typeof marketplaceSchema>;
export type FieldDefinition = z.infer<typeof fieldDefinition>;
export type Constraint = NonNullable<FieldDefinition["constraints"]>[number];
export type Resolution =
  "AUTO_FIX" | "NEEDS_USER_INPUT" | "WALMART_SUPPORT" | "WARNING";
export interface FeedIssue {
  id: string;
  row?: number;
  sku?: string;
  column?: string;
  sheet?: string;
  cell?: string;
  code: string;
  severity: "error" | "warning" | "info";
  level?: "ERROR" | "WARNING" | "INFO";
  fixability?: "SAFE_AUTO_FIX" | "REVIEW_REQUIRED" | "UNSUPPORTED";
  canonicalPath?: string;
  schemaPath?: string;
  resolution: Resolution;
  title: string;
  description: string;
  originalValue?: unknown;
  proposedValue?: unknown;
  source: "FEEDFIX" | "WALMART" | "BOTH";
  confidence: number;
  ruleId?: string;
}
export interface FixOperation {
  issueId: string;
  sheet: string;
  cell: string;
  before: unknown;
  after: unknown;
  ruleId: string;
}
export interface ExternalIssue {
  sku?: string;
  row?: number;
  column?: string;
  code?: string;
  message: string;
}
export interface ParsedCell {
  address: string;
  value: string;
  kind: string;
  formula: boolean;
  safe: boolean;
  raw: string;
}
export interface ParsedSheet {
  visibility?: string;
  name: string;
  path: string;
  xml: string;
  cells: Map<string, ParsedCell>;
}
export interface ParsedWorkbook {
  original: Buffer;
  sheets: ParsedSheet[];
}
