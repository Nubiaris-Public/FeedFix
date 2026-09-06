import { entries, sourceUrls } from "./decoder/knowledge";
import {
  guideLinks,
  type GuideId,
  type ExampleId,
} from "./shared/guide-context";
export type Guide = {
  slug: GuideId;
  title: string;
  seoTitle: string;
  description: string;
  families: string[];
  context: string;
  answer: string;
  confirms: string;
  uncertain: string;
  exampleId: ExampleId;
  editor: "FeedFix";
  publishedAt?: string;
  reviewedAt: string;
  status: "published" | "draft";
  related: GuideId[];
  sections: { title: string; paragraphs: string[]; steps?: string[] }[];
  sources: { title: string; url: string }[];
};
const existingGuides = [
  {
    slug: "walmart-gtin-upc-errors",
    title: "How to investigate Walmart GTIN and UPC errors",
    description:
      "Separate barcode formatting mistakes from product identity problems, preserve leading zeros, and review identifiers without inventing replacements.",
    sections: [
      {
        title: "Start with the exact identifier",
        paragraphs: [
          "Keep the original workbook and the processing report together. Find the reported item by its SKU, then compare the identifier in the workbook with the value from the product owner. A displayed number and the value stored in a spreadsheet cell can differ. Inspect the cell before changing it.",
          "Leading zeros are part of an identifier. If a spreadsheet has already removed them, changing the cell format to text does not recover the original value. Return to the authoritative product record rather than guessing how many zeros to add.",
        ],
      },
      {
        title: "A valid checksum is only one check",
        paragraphs: [
          "GS1 identifiers use a check digit to help detect certain transcription errors. A passing check digit does not establish that the identifier belongs to your product. Check the product assignment as well as the format.",
          "Do not replace the final digit simply to make a validator pass. That would change the identifier rather than establish which product you are selling. A catalog mismatch needs evidence from the product record, not an automatically generated number.",
        ],
      },
      {
        title: "A safe review sequence",
        steps: [
          "Locate the reported SKU and identifier cell without sorting or rebuilding the workbook.",
          "Compare the full stored value against the product owner's identifier, including leading zeros.",
          "Check the identifier type requested by the template and use GS1's tools where appropriate.",
          "Correct only a confirmed transcription or formatting mistake. If identity remains uncertain, leave it for review.",
          "Resubmit through Seller Center and read the new processing result; a local check is not Walmart acceptance.",
        ],
        paragraphs: [
          "FeedFix never invents a replacement GTIN or SKU. Automatic checks are available only for explicitly supported workbook mappings; consult the compatibility page before uploading.",
        ],
      },
    ],
    sources: [
      {
        title: "GS1: how the check digit is calculated",
        url: "https://www.gs1.org/services/how-calculate-check-digit-manually",
      },
    ],
  },
  {
    slug: "walmart-required-fields-allowed-values",
    title: "Fix missing fields and invalid values in a Walmart spreadsheet",
    description:
      "Investigate required-field and allowed-value errors using the right product type and template, with examples of safe corrections and ambiguous values.",
    sections: [
      {
        title: "Check the template before the value",
        paragraphs: [
          "A field can be required for one product type and irrelevant for another. Start by checking the selected product type and the workbook's declared version. Do not copy a requirement from an unrelated category or assume an old template has the same rules as a current one.",
          "Walmart's template guidance describes field definitions, closed lists and requirements that vary with the selected product types. Use those instructions together with the processing report. Preserve the template's header rows and tab names.",
        ],
      },
      {
        title: "Missing and invalid are different problems",
        paragraphs: [
          "A missing-field error asks for information that is absent. The next action is to obtain that information from a reliable product record. An invalid-value error means there is a value, but it does not satisfy the applicable rule. It may be a spelling issue, an incorrect category, an unsupported option or a genuine product mismatch.",
          "For a synthetic example, suppose a field permits Red, Blue or Green. The value purple cannot be safely converted to Red. A reviewer must determine the correct information. By contrast, whitespace around a known option may be removable if the applicable rules and cell structure permit the change.",
        ],
      },
      {
        title: "Review changes as a group",
        steps: [
          "Find the error's field in the template's definitions and check its product-type context.",
          "Inspect the original cell and its stored type, not only how Excel displays it.",
          "Obtain missing facts from your product records; avoid placeholder values used solely to pass validation.",
          "Review dependent fields together and validate again after a confirmed change.",
          "Keep unresolved choices visible for human review instead of treating every error as automatically repairable.",
        ],
        paragraphs: [
          "FeedFix's safe correction model is conservative: a candidate change must satisfy the relevant checks, and ambiguous values remain for review. This guide does not imply that your template is currently supported.",
        ],
      },
    ],
    sources: [
      {
        title: "Walmart: full setup template guidance",
        url: "https://marketplacelearn.walmart.com/guides/Item%20setup/Item%20setup%20methods/Add-items-in-bulk:-full-setup",
      },
    ],
  },
  {
    slug: "walmart-processing-report",
    title: "How to investigate a Walmart item setup processing report",
    description:
      "Connect processing errors to the original workbook, distinguish local data issues from catalog problems, and preserve workbook structure during repair.",
    sections: [
      {
        title: "Keep the report tied to its upload",
        paragraphs: [
          "Save the workbook you submitted alongside the processing result for that submission. A report from an earlier attempt may describe cells that have already changed. Use the item identifier and field information in the report to find the affected record; do not assume that a displayed row number always equals an Excel row number.",
          "Start with a small set of reported items. Record what the error says, what the workbook contains and what your product record confirms. This gives you a reviewable reason for each edit instead of a series of speculative changes.",
        ],
      },
      {
        title: "Separate the kinds of work",
        paragraphs: [
          "Some errors concern a value you control, such as missing information or an option outside a permitted list. Others concern product identity, catalog matching or a service-side issue. Walmart's troubleshooting guide covers several error categories and directs sellers to the relevant resolution paths.",
          "A spreadsheet tool can inspect local data and template rules. It cannot prove that Walmart's catalog will accept an item, change your account eligibility or resolve every catalog conflict. Keep the original error message when a problem needs Seller Center or support investigation.",
        ],
      },
      {
        title: "Preserve the original workbook",
        steps: [
          "Work on a copy of the submitted workbook and retain the original for comparison.",
          "Change only confirmed cells. Avoid rebuilding the file from visible values.",
          "Preserve hidden sheets, formulas, validations, tab order and template headers.",
          "Compare the repaired file with the original and confirm that unresolved errors remain visible.",
          "Upload the reviewed result in Seller Center and inspect the new processing response.",
        ],
        paragraphs: [
          "FeedFix accepts an optional XLSX or CSV processing report, but interpretation depends on a configured report mapping. An arbitrary report is not automatically understood. Supported repairs patch the original workbook package, and a local PASS does not guarantee marketplace acceptance.",
        ],
      },
    ],
    sources: [
      {
        title: "Walmart: troubleshoot item setup errors",
        url: "https://marketplacelearn.walmart.com/guides/Item%20setup/Troubleshooting/troubleshoot-item-setup-errors",
      },
    ],
  },
];

const additions = [
  {
    slug: "walmart-missing-attribute-metadata",
    title: "Walmart missing attribute metadata: what to check",
    description:
      "Investigate missing template metadata, preserve the required header rows and check added multi-select columns before rebuilding a Walmart XLSX.",
    sections: [
      {
        title: "Investigate the template structure",
        paragraphs: [
          "Metadata describes a field; it is different from a missing product value. A visible column name can remain while the information Walmart needs to interpret that column has been altered.",
          "In the Seller Center upload workflow covered by Walmart’s troubleshooting guide, preserve rows 1–6. For added multi-select columns, carry over all metadata in rows 4–6. These row instructions belong to that template workflow, not to arbitrary CSV files or API payloads.",
        ],
        steps: [
          "Keep the rejected file unchanged and work on a copy. Note the tab named by the error.",
          "Compare its headers and added columns with an unmodified template for the same product type and workflow. Inspect hidden content as well as visible headings.",
          "If you cannot establish what was changed, obtain a fresh template from Seller Center. Transfer confirmed product values to the matching fields without replacing headers or bringing old formatting across.",
          "For extra multi-select values, follow the template’s column-copy instructions and verify the metadata, not only the visible label. Submit the reviewed template and inspect the new result.",
        ],
      },
      {
        title: "Synthetic example: an added material column",
        paragraphs: [
          "A seller adds a second material column by copying only its visible title and product values. The header looks correct, but the added column lacks the same metadata as the original. Compare the two columns before deciding whether to repair the copy or transfer values into a fresh template. This is an illustrative scenario, not a diagnosis of your file.",
        ],
      },
      {
        title: "What not to change blindly",
        paragraphs: [
          "Do not invent header metadata, delete the first rows, rename tabs or assume a particular cell is damaged. An error mentioning Footwear does not prove cell A5 is wrong. Do not apply headers from an unrelated category or version.",
        ],
      },
    ],
    sources: [
      {
        title:
          "Walmart: troubleshoot item setup errors — metadata and upload errors",
        url: sourceUrls.setup,
      },
      {
        title: "Walmart: add multiple items with Full setup",
        url: sourceUrls.template,
      },
    ],
  },
  {
    slug: "walmart-sku-already-used",
    title: "Walmart SKU already used: duplicate or catalog conflict?",
    description:
      "Distinguish a repeated SKU in your spreadsheet from a SKU associated with another product or GTIN in Walmart’s catalog, including the WFS-specific guidance.",
    sections: [
      {
        title: "Check two different places",
        paragraphs: [
          "A duplicate inside a workbook means two records contain the same SKU. A catalog conflict concerns an existing or historical association in Seller Center. A file with only one occurrence can still have a catalog conflict; removing duplicate rows alone would not resolve it.",
        ],
        steps: [
          "Find every occurrence of the reported SKU in the submitted workbook. Compare product identity, identifier type and GTIN before treating records as duplicates.",
          "In Seller Center, review the SKU’s existing item and identifier association. Compare that with your authoritative product record. Decide whether this submission is an update to the same item or an attempt to create a different one.",
          "If the records represent different products, stop reusing the SKU. Choose an identifier through your own catalog process after checking downstream inventory and order integrations.",
          "If the current association or history cannot be reconciled, investigate with Walmart Support. Provide the relevant submission details privately to Walmart, not in a public error example.",
        ],
      },
      {
        title: "WFS-specific instruction",
        paragraphs: [
          "Walmart’s WFS item-template troubleshooting guide describes a SKU previously associated with a different GTIN, including a SKU retained as a reference after an ID change. Its stated remedy is a unique SKU; in that WFS template the SKU is in the first column of Product Content and Site Exp. Do not assume that column position or tab exists in every seller-fulfilled template.",
        ],
      },
      {
        title: "Synthetic example: one row can still conflict",
        paragraphs: [
          "In an illustrative catalog, DEMO-CUP was used for a single cup. A new workbook contains DEMO-CUP once, now assigned to a two-cup set. A duplicate-row check passes, but the SKU still refers to a different sellable product. Confirm the association before choosing a new SKU; never change the GTIN to disguise the difference.",
        ],
      },
      {
        title: "What not to change blindly",
        paragraphs: [
          "Do not delete an existing listing, append random suffixes to all SKUs or replace product identifiers merely to silence the error. Those changes can disconnect inventory references. A workbook tool cannot determine your account’s catalog history.",
        ],
      },
    ],
    sources: [
      {
        title: "Walmart: troubleshoot WFS item template errors — reused SKU",
        url: sourceUrls.wfs,
      },
      {
        title: "Walmart: troubleshoot product ID errors",
        url: sourceUrls.product,
      },
    ],
  },
];
existingGuides[0].sources.push({
  title: "Walmart: troubleshoot product ID errors",
  url: sourceUrls.product,
});
existingGuides[0].sections.unshift({
  title: "Format, length and a synthetic example",
  paragraphs: [
    "GS1 defines GTIN structures with 8, 12, 13 and 14 digits; that does not mean every structure belongs in every Walmart field. Check the selected Product ID Type and the template definition. A GTIN-12 has 12 digits including its check digit. Separate an incorrect digit count from spaces, punctuation or Excel scientific notation.",
    "Synthetic example: a product record contains the illustrative string 001234567890, but the worksheet stores 1234567890. This is a comparison exercise, not a licensed identifier to submit. Formatting the shortened value as text cannot recover the missing characters. Copy the confirmed original from the product record, then verify its check digit and product assignment separately.",
    "Do not apply the WFS 14-digit representation instruction to every UPC field. If a template calls for a different representation, establish the underlying identifier first; padding is not a way to invent missing identity.",
  ],
});
existingGuides[1].sections.unshift({
  title: "Three checks, three different decisions",
  paragraphs: [
    "In Full setup, choose Spec Product Type before completing the remaining fields so the applicable attributes and closed lists are available. The template’s definitions are the starting point, not a list copied from a different category.",
    "Synthetic comparison: an empty length needs a verified measurement; the text 'ten' in a numeric field needs the number and applicable unit confirmed; an option 'Purple' outside a hypothetical Red/Blue/Green list needs a product-type and factual review. These cases do not justify the same automatic replacement.",
  ],
});
existingGuides[2].sections.unshift({
  title: "Find the submission, then correlate the record",
  paragraphs: [
    "In Seller Center’s Activity Feed, filter to Item Setup and identify the submission before downloading its Error Report. Keep the submitted workbook, not a newer working copy, as the comparison source. An upload validation error file and a later processing report can have different layouts.",
    "Synthetic example: report row 2 names DEMO-MUG and the color field. The original workbook has that SKU at Excel row 9 because header rows and other products come first. Match the SKU and field to that row; do not edit Excel row 2. If two records share DEMO-MUG, compare their product identifiers and submission context before deciding which one the report concerns.",
    "Write a small private comparison: submission, reported item, field, original value and proposed change. If the report lacks enough identifiers to make a unique match, leave the issue unmatched rather than guessing. Do not reorder the workbook to imitate the report.",
  ],
});
const editorial: Record<
  GuideId,
  Pick<
    Guide,
    | "status"
    | "reviewedAt"
    | "context"
    | "answer"
    | "confirms"
    | "uncertain"
    | "families"
    | "related"
  >
> = {
  "walmart-gtin-upc-errors": {
    reviewedAt: "2026-09-06",
    status: "published",
    context:
      "US Walmart Marketplace item setup in Seller Center; XLSX identifiers. WFS-specific formatting is not a universal rule.",
    answer:
      "Check the identifier’s stored characters and requested type first, then its check digit and actual product assignment. A correctly formatted barcode can still identify the wrong product.",
    confirms:
      "A product ID error means Walmart rejected the submitted identifier or its use in that submission.",
    uncertain:
      "The message alone cannot prove whether Excel changed the value, a digit was mistyped, or the product identity is wrong.",
    families: ["product-id"],
    related: ["walmart-sku-already-used", "walmart-processing-report"],
  },
  "walmart-required-fields-allowed-values": {
    reviewedAt: "2026-09-06",
    status: "published",
    context:
      "US Seller Center Full setup XLSX, with requirements determined by the selected product type.",
    answer:
      "First distinguish an empty required field from a present but incorrectly formatted value or an option outside the permitted list. Check the correct product type and template before editing the value.",
    confirms:
      "The submitted data did not satisfy a field requirement in the applicable setup context.",
    uncertain:
      "The error does not identify the correct missing fact or prove that the chosen product type is appropriate.",
    families: [
      "missing-required-attributes",
      "invalid-attribute-values",
      "allowed-values",
    ],
    related: [
      "walmart-missing-attribute-metadata",
      "walmart-processing-report",
    ],
  },
  "walmart-processing-report": {
    reviewedAt: "2026-09-06",
    status: "published",
    context:
      "US Seller Center item setup submissions and their downloaded error reports; not a generic API error-code reference.",
    answer:
      "Find the report for the exact submission, then match its item and field information to the submitted workbook. A report row is not automatically an Excel row address.",
    confirms:
      "The report records problems for a particular submission. Its contents may be outdated after a later upload.",
    uncertain:
      "A row number alone does not establish the affected workbook cell, and a spreadsheet cannot resolve every catalog or account issue.",
    families: ["error-report-correlation"],
    related: [
      "walmart-required-fields-allowed-values",
      "walmart-gtin-upc-errors",
      "walmart-missing-attribute-metadata",
    ],
  },
  "walmart-missing-attribute-metadata": {
    reviewedAt: "2026-09-06",
    status: "published",
    context:
      "US Seller Center item setup spreadsheet upload; header and multi-select metadata in the workflow documented by Walmart.",
    answer:
      "Walmart could not read required template information. Compare the affected tab with an untouched template; if you cannot identify what was altered, obtain a fresh spreadsheet instead of guessing metadata.",
    confirms:
      "The named tab has a template-metadata problem from Walmart’s perspective.",
    uncertain:
      "The error does not identify the damaged cell or establish which edit caused it. It is not evidence that product attribute values are missing.",
    families: ["missing-attribute-metadata"],
    related: [
      "walmart-required-fields-allowed-values",
      "walmart-processing-report",
    ],
  },
  "walmart-sku-already-used": {
    reviewedAt: "2026-09-06",
    status: "published",
    context:
      "US Seller Center catalog investigation, with explicitly labelled WFS item-template instructions.",
    answer:
      "Check whether the SKU repeats within the workbook or is already associated with a different item in Seller Center. A unique row in your file does not establish that the SKU is available in your catalog.",
    confirms:
      "The documented WFS reused-SKU message points to an existing or historical association, not necessarily a duplicate row.",
    uncertain:
      "FeedFix cannot inspect Seller Center history from a pasted message or an XLSX. The correct catalog action requires your review.",
    families: ["sku-reused"],
    related: ["walmart-gtin-upc-errors", "walmart-processing-report"],
  },
};
// Each date records this actual editorial review, not a build timestamp. Original
// publication dates are unknown and intentionally omitted; new guides are editorially approved
// for release; live publication timestamps remain unknown until deployment.
export const guides: Guide[] = [...existingGuides, ...additions].map((g) => {
  const id = g.slug as GuideId;
  const link = guideLinks.find((x) => x.slug === id)!;
  return {
    ...g,
    slug: id,
    seoTitle: `${g.title} | FeedFix`,
    ...editorial[id],
    exampleId: link.example,
    editor: "FeedFix",
    sources: g.sources,
  };
});
export function documentedRules(g: Guide) {
  return entries
    .filter((e) => g.families[0] === e.entryId)
    .flatMap((e) =>
      e.causes
        .filter((c) => c.certainty === "DOCUMENTED")
        .map((c) => ({ text: c.text, source: e.sources[0].url })),
    );
}
export const publishedGuides = guides.filter((g) => g.status === "published");
