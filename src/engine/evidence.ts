import { readBoundedJson, digest } from "./compiled-graph";
import type { EvidenceOrigin, MarketplaceSchema } from "./model";
export function schemaOrigin(schema: MarketplaceSchema): EvidenceOrigin {
  return schema.synthetic ? "SYNTHETIC" : (schema.origin ?? "UNKNOWN");
}
export function mappingHash(schema: MarketplaceSchema) {
  return digest(
    JSON.stringify({
      version: schema.version,
      origin: schemaOrigin(schema),
      sheet: schema.sheet,
      headerRow: schema.headerRow,
      marker: schema.marker,
      fields: schema.fields.map((f) => ({
        column: f.column,
        canonicalPath: f.canonicalPath,
        schemaPath: f.schemaPath,
        encoding: f.encoding,
      })),
      compiled: schema.compiled
        ? {
            sourceSha256: schema.compiled.sourceSha256,
            productType: schema.compiled.productType,
            feedHeader: schema.compiled.feedHeader,
          }
        : null,
    }),
  );
}
export function supportEvidence(schema: MarketplaceSchema) {
  const origin = schemaOrigin(schema);
  const base = {
    origin,
    mappingSha256: mappingHash(schema),
    schemaSha256: schema.compiled?.sourceSha256,
    paidSupportEligible: false,
  };
  if (
    origin !== "WALMART_CURRENT_SUPPORTED" ||
    !schema.compiled ||
    !schema.goldenEvidencePath
  )
    return base;
  try {
    const evidence = readBoundedJson(schema.goldenEvidencePath, 128 * 1024);
    return {
      ...base,
      paidSupportEligible:
        evidence.format === "feedfix-golden-v1" &&
        evidence.status === "PASS" &&
        evidence.origin === origin &&
        evidence.mappingSha256 === base.mappingSha256 &&
        evidence.schemaSha256 === base.schemaSha256 &&
        evidence.schemaVersion === schema.version &&
        typeof evidence.reviewedBy === "string" &&
        evidence.reviewedBy.trim().length > 0 &&
        /^[a-f0-9]{64}$/.test(evidence.fixtureSha256),
    };
  } catch {
    return base;
  }
}

export function hasCurrentWorkbookSupport(schema: MarketplaceSchema) {
  return supportEvidence(schema).paidSupportEligible;
}
