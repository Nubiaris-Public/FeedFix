import type { DecoderMatch, DecoderResult } from "../shared/error-decoder";
import { normalizeMessage } from "./input";
const learn = "https://marketplacelearn.walmart.com/guides/";
export const sourceUrls = {
  setup: learn + "Item%20setup/Troubleshooting/troubleshoot-item-setup-errors",
  product:
    learn + "Item%20setup/Troubleshooting/Troubleshoot-product-ID-errors",
  image:
    learn +
    "Item%20setup/Item%20content,%20imagery,%20and%20media/Product-detail-page:-Image-guidelines-&-requirements",
  variant:
    learn +
    "Item%20setup/Variant%20management/Create-a-variant-group:-Full-Setup-Template",
  template:
    learn + "Item%20setup/Item%20setup%20methods/Add-items-in-bulk:-full-setup",
  wfs:
    learn +
    "Walmart%20Fulfillment%20Services%20%28WFS%29/Troubleshooting/Troubleshoot-item-feed-errors",
  requirements:
    "https://developer.walmart.com/us-marketplace/docs/get-item-setup-requirements",
  version:
    "https://developer.walmart.com/global-marketplace/docs/item-spec-versioning-and-diff-reporting",
  date: "https://developer.walmart.com/us-marketplace/page/item-spec-50-version-update",
  codes: "https://developer.walmart.com/us-marketplace/docs/error-codes",
};
export const approvedSources = Object.values(sourceUrls);
type Entry = Omit<DecoderMatch, "status"> & {
  exact: string[];
  patterns: RegExp[];
  documentedPattern?: boolean;
  reviewedAt: string;
  evidence: string;
};
function entry(
  id: string,
  title: string,
  source: keyof typeof sourceUrls,
  evidence: string,
  patterns: RegExp[],
  meaning: string,
  cause: string,
  steps: string[],
  checklist: string[],
  options: {
    exact?: string[];
    documentedPattern?: boolean;
    workbookChecks?: string;
  } = {},
): Entry {
  return {
    entryId: id,
    slug: id,
    family: id,
    title,
    meaning,
    causes: [{ certainty: "DOCUMENTED", text: cause }],
    steps,
    checklist,
    sources: [
      { label: "Walmart Marketplace documentation", url: sourceUrls[source] },
    ],
    requiresWorkbook: true,
    workbookChecks:
      options.workbookChecks ??
      "The pasted message does not identify the stored cell values or prove the cause. A supported workbook inspection can check its mapped fields; Seller Center catalog state still needs your review.",
    exact: options.exact ?? [],
    patterns,
    documentedPattern: options.documentedPattern,
    reviewedAt: "2026-09-06",
    evidence,
  };
}
// Specific families precede general validation. Multiple unrelated matches fail closed.
export const entries: Entry[] = [
  entry(
    "missing-attribute-metadata",
    "Missing attribute metadata",
    "setup",
    "Common upload errors / Missing attribute metadata; rows 1–6 and multi-select rows 4–6.",
    [
      /^your file is missing (?:a |an )?attribute metadata in .{1,120} tab[.!]?(?: ?please download a new spreadsheet[.!]?)?$/i,
    ],
    "Walmart cannot find the template information that describes its attributes.",
    "Walmart instructs sellers to preserve rows 1–6, including metadata for added multi-select columns.",
    [
      "If you cannot identify the alteration, download a fresh template in Seller Center.",
      "Transfer product values without replacing template headers. For added multi-select columns, preserve the metadata in rows 4–6.",
    ],
    ["Header metadata preserved.", "Added columns include their metadata."],
    {
      exact: ["Missing attribute metadata"],
      documentedPattern: true,
      workbookChecks:
        "We would need the spreadsheet to inspect headers, hidden metadata and added columns. This message cannot tell us which cell was altered.",
    },
  ),
  entry(
    "sku-reused",
    "SKU previously used for another product",
    "wfs",
    "Errors and next steps / SKU previously used with a different GTIN.",
    [
      /\bsku\b.{0,90}\b(?:previously used|already (?:used|being used))\b.{0,90}\b(?:gtin|item|product)\b/i,
    ],
    "The message may refer to a SKU already associated with another item.",
    "Walmart documents rejection of SKUs previously used with a different GTIN.",
    [
      "Compare the SKU and product identifier with your existing Seller Center item.",
      "For a different item, assign a new unique SKU. Do not rename existing inventory blindly.",
    ],
    [
      "SKU identifies the intended item.",
      "Existing catalog association checked.",
    ],
  ),
  entry(
    "variant-attributes",
    "Variant group attributes",
    "variant",
    "Step 2 / Variant Group ID, Variant Attribute Names, Is Primary Variant.",
    [
      /\bvariant (?:group id|attribute names?|group)\b.{0,100}\b(?:missing|required|invalid|error)\b/i,
      /\b(?:missing|required|invalid|error)\b.{0,100}\bvariant (?:group|attribute)\b/i,
    ],
    "The message points to incomplete or inconsistent variant information.",
    "Related variants need a shared group ID, variant attribute names and a primary variant selection.",
    [
      "Check every item intended for the group has the same Variant Group ID.",
      "Select the applicable variant attribute names and supply each item's distinguishing values.",
      "Check the Is Primary Variant field against the template instructions for the group.",
    ],
    [
      "Only related items share the group.",
      "Variant values and primary selection reviewed.",
    ],
  ),
  entry(
    "image-url",
    "Image URL requirements",
    "image",
    "Image URL requirements / publicly accessible direct image URL.",
    [
      /\bimage url\b.{0,100}\b(?:invalid|not|must|error|requirement)\b/i,
      /\binvalid (?:main )?image url\b/i,
    ],
    "Walmart may be unable to use the supplied image link.",
    "Image links must expose an image publicly and meet Walmart's image requirements.",
    [
      "Open the image link yourself in a signed-out browser; confirm it shows the image directly.",
      "Replace login-only or webpage links with a public image URL that meets the linked requirements.",
    ],
    [
      "Direct image opens without login.",
      "Image format meets the official guide.",
    ],
    {
      workbookChecks:
        "A workbook can reveal the stored URL. FeedFix does not fetch pasted URLs or verify remote availability.",
    },
  ),
  entry(
    "product-id",
    "Product ID validation",
    "product",
    "Common product ID errors / transcription, copying, nonexistent IDs; length and checksum checks are also verified by src/engine/rules.ts.",
    [
      /\b(?:invalid|incorrect|missing)\b.{0,40}\b(?:gtin|upc|ean|product id|check digit)\b/i,
      /\b(?:gtin|upc|ean|product id|check digit)\b.{0,65}\b(?:invalid|incorrect|validation|length|checksum)\b/i,
    ],
    "The identifier may not satisfy the selected product ID type.",
    "Walmart documents product ID failures caused by typos, copying mistakes and nonexistent identifiers.",
    [
      "Compare Product ID Type and Product ID with the barcode or authoritative product record.",
      "Check length, digits and leading zeros. Correct only a confirmed transcription mistake; never invent a barcode to pass a checksum.",
    ],
    [
      "Identifier belongs to this product.",
      "Type, digits and leading zeros reviewed.",
    ],
    { exact: ["Invalid product ID"] },
  ),
  entry(
    "inventory-date",
    "Inventory availability date format",
    "date",
    "Inventory Availability Date attribute changed from date-time to date in the specified 5.0 update.",
    [
      /\binventory\s*availability\s*date\b.{0,80}\b(?:invalid|format|date-time|error)\b/i,
      /\b(?:invalid|format|error)\b.{0,70}\binventory\s*availability\s*date\b/i,
    ],
    "This may be a date-format mismatch for Inventory Availability Date.",
    "Walmart's documented 5.0 update changes this specific attribute to a date without a time.",
    [
      "Confirm the field is Inventory Availability Date and check your template version.",
      "For the documented date-format version, use yyyy-mm-dd, for example 2026-09-06. Do not apply this rule to other date-time fields.",
    ],
    ["Actual calendar date verified.", "Field and template version checked."],
  ),
  entry(
    "template-version",
    "Template or specification mismatch",
    "version",
    "US feed type/version table and diff reports; API versions do not establish XLSX compatibility.",
    [
      /\b(?:template|spreadsheet|specification|schema)\b.{0,60}\b(?:version mismatch|outdated|unsupported version|wrong version)\b/i,
      /\b(?:outdated|unsupported|invalid|wrong)\b.{0,25}\b(?:template|spreadsheet)\b/i,
    ],
    "The message may refer to a layout or version that the selected submission flow does not accept.",
    "Walmart publishes different specifications by feed type and version, with changes to fields and allowed values.",
    [
      "Confirm whether you are creating, matching, maintaining or converting items.",
      "Download the appropriate template from that Seller Center workflow and transfer values into its defined fields. An API schema is not an Excel template.",
    ],
    [
      "Submission workflow matches the template.",
      "Version and product types checked.",
    ],
  ),
  entry(
    "product-type",
    "Product type requirements",
    "requirements",
    "Invalid productTypes for requested feedType/version; requirements depend on product type.",
    [
      /\b(?:category|product type)\b.{0,60}\b(?:mismatch|invalid|not valid|incorrect|not supported)\b/i,
      /\b(?:invalid|incorrect|unsupported) (?:category|product type)\b/i,
    ],
    "The selected category or product type may not fit the applicable specification.",
    "Product types and their requirements are tied to the feed type and version.",
    [
      "Check the product type selected when building the template against your actual product.",
      "Use the matching template's definitions before transferring values.",
    ],
    [
      "Product type checked against the item.",
      "Version matches the selected flow.",
    ],
  ),
  entry(
    "allowed-values",
    "Value outside the allowed list",
    "wfs",
    "Formatting issues / template dropdown lists; field-specific choices in Data Definitions.",
    [
      /\b(?:closed[- ]list|allowed values?|permitted values?|enumeration|enum)\b.{0,80}\b(?:invalid|not|error|must)\b/i,
      /\b(?:invalid|not|outside|must)\b.{0,80}\b(?:closed[- ]list|allowed values?|permitted values?|enumeration|enum)\b/i,
    ],
    "The value may be outside the field's defined choices.",
    "Template definitions specify closed lists for fields that only accept designated options.",
    [
      "Find the field in Data Definitions for your product type.",
      "Select the correct permitted option from the template dropdown. Do not substitute a different product fact merely to pass validation.",
    ],
    [
      "Option belongs to this field's list.",
      "Selected option is factually correct.",
    ],
  ),
  entry(
    "number-format",
    "Numeric value or range",
    "requirements",
    "Spec response / numeric limits and field constraints.",
    [
      /\b(?:invalid|incorrect) (?:number|numeric|integer|decimal)\b/i,
      /\b(?:must be|expected) (?:a |an )?(?:number|integer|decimal)\b/i,
      /\b(?:number|numeric value)\b.{0,40}\bout of range\b/i,
    ],
    "A numeric field may contain the wrong type or an out-of-range value.",
    "The applicable specification defines field types and numeric limits.",
    [
      "Find the reported field's type, units and bounds in its definition.",
      "Inspect the stored cell value, then enter the verified number in the required units and range.",
    ],
    ["Units and bounds verified.", "Number is stored as the expected type."],
  ),
  entry(
    "missing-required-attributes",
    "Missing required attributes",
    "template",
    "Full setup / required fields and Data Definitions.",
    [
      /\bmissing (?:a |an )?required (?:attributes?|fields?|cells?|values?)\b/i,
      /\b(?:attribute|field|cell)\b.{0,60}\b(?:is required|must not be (?:empty|blank))\b/i,
    ],
    "A required value appears to be absent.",
    "Required fields depend on the selected product type and template instructions.",
    [
      "Find the reported attribute in the matching template's definitions.",
      "Obtain the missing fact from your product records and fill the required field. Do not use placeholder data.",
    ],
    ["Required cells completed.", "Conditional requirements reviewed."],
  ),
  entry(
    "invalid-attribute-values",
    "Invalid attribute value",
    "requirements",
    "Spec / types, enums, formats and validation limits.",
    [/\binvalid (?:attribute|field) value\b/i],
    "A value appears to violate an attribute's rule; the text does not tell us which rule.",
    "Specifications can constrain type, format, length, range and allowed values.",
    [
      "Read the field definition for the applicable product type.",
      "Compare the original value with that rule and correct only a verified discrepancy.",
    ],
    [
      "Applicable field rule identified.",
      "Replacement verified against product records.",
    ],
  ),
  entry(
    "invalid-feed-data",
    "Feed data validation failed",
    "codes",
    "Feed validation / ERR_PDI_0034; broad data failure, not a specific cell diagnosis.",
    [/\berr_pdi_0034\b/i],
    "Walmart reports missing or invalid feed data, without identifying a single cause from this code alone.",
    "Required data, types or numeric ranges may fail feed validation.",
    [
      "Read the accompanying field-level error details.",
      "Check the named fields against the specification for your submission. For XLSX, use its matching template definitions.",
    ],
    ["Detailed errors reviewed.", "Required values and ranges checked."],
    { exact: ["ERR_PDI_0034"], documentedPattern: true },
  ),
  entry(
    "error-report-correlation",
    "Find the affected workbook cells",
    "setup",
    "Common upload errors / Error file; correlation also verified in src/engine/processing-report.ts.",
    [
      /\b(?:walmart |upload |processing )?error report\b.{0,90}\b(?:row|column|cell|correlat|match)/i,
    ],
    "The report provides context for locating an error, rather than a diagnosis by itself.",
    "Walmart's upload error file describes errors and highlights affected cells.",
    [
      "Pair the report with the exact workbook submission it describes.",
      "Inspect the highlighted cells and error descriptions. FeedFix can correlate supported reports by exact row/column or unique SKU after optional upload.",
    ],
    [
      "Report and workbook belong to the same submission.",
      "No guessed row offsets or ambiguous SKU matches.",
    ],
    {
      workbookChecks:
        "Both the original workbook and a supported report layout are needed for exact correlation. A pasted row number alone is insufficient.",
    },
  ),
];
export function decode(value: unknown): DecoderResult {
  const text = normalizeMessage(value)
    .toLowerCase()
    .replace(/(?:https?:\/\/|www\.)\S+/g, "")
    .trim();
  const unknown: DecoderResult = {
    status: "UNKNOWN",
    shareAvailable: true,
    workbookCheckAvailable: true,
  };
  if (
    /\b(?:no|not|without) (?:an? |any )?(?:missing|invalid|incorrect)\b/.test(
      text,
    )
  )
    return unknown;
  let matches = entries.filter(
    (e) =>
      e.exact.some((x) => x.toLowerCase() === text) ||
      e.patterns.some((p) => p.test(text)),
  );
  if (matches.length > 1)
    matches = matches.filter(
      (e) =>
        ![
          "missing-required-attributes",
          "invalid-attribute-values",
          "invalid-feed-data",
          "error-report-correlation",
        ].includes(e.entryId),
    );
  if (matches.length !== 1) return unknown;
  const {
    exact,
    patterns: _patterns,
    documentedPattern,
    reviewedAt: _reviewedAt,
    evidence: _evidence,
    ...result
  } = matches[0];
  void _patterns;
  void _reviewedAt;
  void _evidence;
  if (!result.sources.every((s) => approvedSources.includes(s.url)))
    throw new Error("Unapproved decoder source");
  return {
    ...result,
    status:
      documentedPattern || exact.some((x) => x.toLowerCase() === text)
        ? "DOCUMENTED"
        : "LIKELY_MATCH",
  };
}
