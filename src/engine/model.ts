import { z } from 'zod';
export const fieldDefinition = z.object({
  column: z.string().min(1), type: z.enum(['string','number','boolean','url','gtin','sku']).optional(),
  required: z.boolean().optional(), maxLength: z.number().int().positive().optional(),
  enumValues: z.array(z.string()).min(1).optional(),
  normalizeWhitespace: z.boolean().optional(),
  constraints: z.array(z.object({ kind: z.enum(['min','max','integer']), value: z.number().optional() })).optional()
});
export const marketplaceSchema = z.object({
  marketplace: z.literal('walmart'), version: z.string(), synthetic: z.boolean(), provenance: z.string(),
  sheet: z.string(), headerRow: z.number().int().positive(),
  marker: z.object({ cell:z.string().regex(/^[A-Z]+[1-9]\d*$/), value:z.string() }),
  fields: z.array(fieldDefinition).min(1),
  variants: z.object({groupColumn:z.string(), consistentColumns:z.array(z.string())}).optional(),
  report: z.object({sheet:z.string().optional(), headerRow:z.number().int().positive().default(1),
    columns:z.object({message:z.string(),sku:z.string().optional(),row:z.string().optional(),column:z.string().optional(),code:z.string().optional()}),
    supportCodes:z.array(z.string()).default([])}).optional()
});
export type MarketplaceSchema = z.infer<typeof marketplaceSchema>;
export type FieldDefinition = z.infer<typeof fieldDefinition>;
export type Constraint = NonNullable<FieldDefinition['constraints']>[number];
export type Resolution = 'AUTO_FIX'|'NEEDS_USER_INPUT'|'WALMART_SUPPORT'|'WARNING';
export interface FeedIssue {
  id:string; row?:number; sku?:string; column?:string; sheet?:string; cell?:string;
  code:string; severity:'error'|'warning'; resolution:Resolution; title:string; description:string;
  originalValue?:unknown; proposedValue?:unknown; source:'FEEDFIX'|'WALMART'|'BOTH'; confidence:number; ruleId?:string;
}
export interface FixOperation { issueId:string; sheet:string; cell:string; before:unknown; after:unknown; ruleId:string }
export interface ExternalIssue { sku?:string; row?:number; column?:string; code?:string; message:string }
export interface ParsedCell { address:string; value:string; kind:string; formula:boolean; safe:boolean; raw:string }
export interface ParsedSheet { name:string; path:string; xml:string; cells:Map<string,ParsedCell> }
export interface ParsedWorkbook { original:Buffer; sheets:ParsedSheet[] }
