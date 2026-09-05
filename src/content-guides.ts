export const guides = [
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
        title: "GS1: check digit calculator",
        url: "https://www.gs1.org/services/check-digit-calculator",
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
        url: "https://marketplacelearn.walmart.com/guides/Walmart%20Fulfillment%20Services%20%28WFS%29/WFS%20item%20setup/WFS-item-spec-sheet-setup?locale=en-US",
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
