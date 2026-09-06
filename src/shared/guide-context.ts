// Public, bounded navigation data. No matcher or internal evidence in this module.
export const guideLinks = [
  {
    slug: "walmart-gtin-upc-errors",
    title: "GTIN and UPC errors",
    example: "product-id",
  },
  {
    slug: "walmart-required-fields-allowed-values",
    title: "Missing fields and allowed values",
    example: "missing-required-attributes",
  },
  {
    slug: "walmart-processing-report",
    title: "Read a processing report",
    example: "error-report-correlation",
  },
  {
    slug: "walmart-missing-attribute-metadata",
    title: "Missing attribute metadata",
    example: "missing-attribute-metadata",
  },
  {
    slug: "walmart-sku-already-used",
    title: "SKU already used",
    example: "sku-reused",
  },
] as const;
export const examples = {
  "product-id": "Invalid product ID",
  "missing-required-attributes": "Missing required attribute: color",
  "error-report-correlation": "Walmart Error Report row correlation",
  "missing-attribute-metadata":
    "Your file is missing attribute metadata in Footwear tab",
  "sku-reused": "This SKU is already being used by another item",
} as const;
export type GuideId = (typeof guideLinks)[number]["slug"];
export type ExampleId = keyof typeof examples;
export const sources = [
  "paid",
  "search_referral",
  "referral",
  "direct",
  "unknown",
] as const;
export type TrafficSource = (typeof sources)[number];
export type PublicContext = { guide_id?: GuideId; source: TrafficSource };
export function guideId(value: unknown): GuideId | undefined {
  return guideLinks.find((g) => g.slug === value)?.slug;
}
export function exampleId(value: unknown): ExampleId | undefined {
  return typeof value === "string" && Object.hasOwn(examples, value)
    ? (value as ExampleId)
    : undefined;
}
export function publicContext(value: unknown): PublicContext {
  const data =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    ...(guideId(data.guide_id) ? { guide_id: guideId(data.guide_id) } : {}),
    source: sources.includes(data.source as TrafficSource)
      ? (data.source as TrafficSource)
      : "unknown",
  };
}
export function classifySource(url: string, referrer: string): TrafficSource {
  try {
    const u = new URL(url);
    if (
      ["gclid", "dclid", "gbraid", "wbraid", "msclkid", "ttclid"].some((k) =>
        u.searchParams.has(k),
      ) ||
      /^(cpc|ppc|paid|paidsearch|paid_social|display)$/i.test(
        u.searchParams.get("utm_medium") ?? "",
      )
    )
      return "paid";
    if (!referrer) return "unknown"; // Direct cannot reliably be distinguished from stripped referrers.
    const r = new URL(referrer);
    if (r.origin === u.origin) return "unknown";
    if (
      /^(www\.)?(google\.(com|co\.uk|com\.mx)|bing\.com|duckduckgo\.com|search\.yahoo\.com)$/.test(
        r.hostname,
      )
    )
      return "search_referral";
    return "referral";
  } catch {
    return "unknown";
  }
}
export function navigationContext(params: URLSearchParams) {
  const guide = guideLinks.find((g) => g.slug === params.get("guide"));
  const action = ["example", "error", "file"].includes(
    params.get("action") ?? "",
  )
    ? params.get("action")
    : "error";
  return { guide, action: guide ? action : "error" };
}
export function toolHref(id: GuideId, action: "example" | "error" | "file") {
  return `/?guide=${id}&action=${action}`;
}
