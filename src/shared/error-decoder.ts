export type DecoderMatch = {
  status: "DOCUMENTED" | "LIKELY_MATCH";
  entryId: string;
  slug: string;
  family: string;
  title: string;
  meaning: string;
  causes: { certainty: "DOCUMENTED" | "LIKELY"; text: string }[];
  steps: string[];
  checklist: string[];
  sources: { label: string; url: string }[];
  requiresWorkbook: true;
  workbookChecks: string;
};
export type DecoderResult =
  | DecoderMatch
  | {
      status: "UNKNOWN";
      shareAvailable: true;
      workbookCheckAvailable: true;
    };
