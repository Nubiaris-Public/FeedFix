import { describe, expect, it } from "vitest";
import { decode, entries, approvedSources } from "../src/decoder/knowledge";
import { normalizeMessage, redactMessage } from "../src/decoder/input";

describe("deterministic decoder", () => {
  it("matches a documented exact phrase, ignoring case and whitespace", () => {
    for (const message of [
      "Missing attribute metadata",
      " MISSING\n attribute   metadata ",
    ]) {
      expect(decode(message)).toMatchObject({
        status: "DOCUMENTED",
        entryId: "missing-attribute-metadata",
      });
    }
  });
  it("matches bounded patterns and prefers specific rules over general required fields", () => {
    expect(
      decode("Your file is missing attribute metadata in Footwear tab"),
    ).toMatchObject({
      status: "DOCUMENTED",
      entryId: "missing-attribute-metadata",
    });
    expect(decode("Missing required attribute: color")).toMatchObject({
      status: "LIKELY_MATCH",
      entryId: "missing-required-attributes",
    });
    expect(
      decode("Missing required attribute: Variant Group ID"),
    ).toMatchObject({ entryId: "variant-attributes" });
    expect(decode("ERR_PDI_0034")).toMatchObject({
      status: "DOCUMENTED",
      entryId: "invalid-feed-data",
    });
    expect(decode("ERR_PDI_00340").status).toBe("UNKNOWN");
  });
  it("does not guess for unknown, ambiguous or negated input", () => {
    for (const message of [
      "The moon ate the upload",
      "There is no missing attribute metadata",
      "invalid GTIN and invalid image URL",
      "https://example.test/missing-attribute-metadata",
    ]) {
      expect(decode(message).status).toBe("UNKNOWN");
    }
  });
  it("rejects empty, oversized and ill-formed Unicode", () => {
    for (const message of ["", " \n ", "x".repeat(4001), "\ud800"])
      expect(() => normalizeMessage(message)).toThrow();
    expect(normalizeMessage("  hello\u200b\nworld ")).toBe("hello world");
  });
  it("only returns approved exact official sources and public entry fields", () => {
    for (const entry of entries) {
      expect(entry.slug).toMatch(/^[a-z0-9-]+$/);
      for (const source of entry.sources) {
        expect(approvedSources).toContain(source.url);
        expect([
          "marketplacelearn.walmart.com",
          "developer.walmart.com",
        ]).toContain(new URL(source.url).hostname);
      }
    }
    const result = JSON.stringify(
      decode("Missing attribute metadata https://evil.test/?token=secret"),
    );
    expect(result).not.toMatch(/evil|secret|patterns|exact|reviewedAt/);
  });
  it("redacts contacts, URLs, files, identifiers and controls for sharing", () => {
    const text = redactMessage(
      "Email seller@example.test file merchant.xlsx SKU: ABC-99 GTIN 12345678901234 https://host.test/x?token=private www.example.test/private \u0000\u202eevent",
    );
    expect(text).not.toMatch(
      /seller@|merchant|ABC-99|12345678901234|host.test|example.test|private|\u0000|\u202e/,
    );
    expect(text).toContain("[email]");
    expect(redactMessage("safe text")).toBe("safe text");
  });
});

it.each([
  ["SKU was previously used with a different GTIN", "sku-reused"],
  ["Invalid variant attribute name", "variant-attributes"],
  ["Main Image URL does not meet our image URL requirements", "image-url"],
  ["Invalid GTIN", "product-id"],
  ["Inventory Availability Date has invalid format", "inventory-date"],
  ["Template version mismatch", "template-version"],
  ["Invalid product type", "product-type"],
  ["Value is not in the allowed values", "allowed-values"],
  ["Must be a number", "number-format"],
  ["Missing required cell", "missing-required-attributes"],
  ["Invalid attribute value", "invalid-attribute-values"],
  ["Walmart Error Report row correlation", "error-report-correlation"],
])("recognizes catalog family: %s", (message, entryId) => {
  expect(decode(message)).toMatchObject({ status: "LIKELY_MATCH", entryId });
});

it("does not impose a date format or image rule outside the documented scope", () => {
  for (const message of [
    "Invalid date",
    "Invalid asset URL for a video",
    "We fixed the missing attribute metadata yesterday",
  ]) {
    expect(decode(message).status).toBe("UNKNOWN");
  }
});

it.each([
  [
    'Upload failed for "North Shop Fall Catalog.xlsx"',
    /North|Shop|Fall|Catalog/,
  ],
  [
    "Upload failed for North Shop Fall Catalog.xlsx; unexpected schema error",
    /North|Shop|Fall|Catalog/,
  ],
  [
    "File C:\\Users\\seller\\Documents\\Private List.xlsm failed",
    /Users|seller|Documents|Private|List/,
  ],
  ["Read /home/merchant/Private List.csv failed", /home|merchant|Private|List/],
  [
    "Authorization: Bearer super-secret-token; unexpected error",
    /Bearer|super-secret/,
  ],
  [
    "Cookie: session=private-value; csrf=another-secret",
    /private-value|another-secret/,
  ],
  ['api_key="private secret value"; unknown error', /private|secret value/],
  [
    'SKU="PRIVATE PRODUCT CODE"; product name: My Private Product',
    /PRIVATE|My Private/,
  ],
  ["Contact seller\u200b@example.test about the upload", /seller|example/],
  [
    "https://private.test/path?token=abc and ftp://private.test/file",
    /private|abc/,
  ],
  ["Call +1 (555) 123-4567; merchant 2001:db8::1234", /555|123-4567|2001:db8/],
  ["Unexpected ERR_FUTURE_123 for ABC-SECRET-99", /ABC-SECRET/],
])("removes private fragments: %s", (message, privateFragments) => {
  const redacted = redactMessage(message);
  expect(redacted).not.toMatch(privateFragments);
  expect(redactMessage(redacted)).toBe(redacted);
});

it("retains unknown error codes and useful generic wording", () => {
  expect(
    redactMessage("Unexpected ERR_FUTURE_123: required attribute unavailable"),
  ).toContain("ERR_FUTURE_123");
});

it("enforces the size bound after Unicode normalization as well", () => {
  expect(() => normalizeMessage("\u0344".repeat(4000))).toThrow();
});

it.each([
  ['{"Cookie": "session=do-not-store"}', /do-not-store/],
  ["accessToken: do-not-store; unknown error", /do-not-store/],
  ["File: Unusual Merchant Export.customformat", /Unusual|Merchant|Export/],
  ["Unknown identifier 12345678", /12345678/],
])(
  "handles structured keys and identifier edge cases: %s",
  (message, secret) => {
    const result = redactMessage(message);
    expect(result).not.toMatch(secret);
    expect(redactMessage(result)).toBe(result);
  },
);
