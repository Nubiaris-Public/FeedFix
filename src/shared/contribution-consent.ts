// Reserve one minute for the 30-second background deletion sweep.
export const CONTRIBUTION_CONSENT_VERSION = "workbook-study-1h-v2";
export const CONTRIBUTION_TTL_MS = 59 * 60 * 1000;
export const LEGACY_CONTRIBUTION_CONSENT_TEXT =
  "I authorize FeedFix to keep a private copy of this original workbook for up to one hour to study its structure and improve template support, even if analysis fails. The copy may contain my product data. It will not be used for AI training or published. I have permission to share it.";
export const CONTRIBUTION_CONSENT_TEXT =
  LEGACY_CONTRIBUTION_CONSENT_TEXT +
  " FeedFix will retain aggregate counts of structural features to prioritize improvements after the copy and its report are deleted. These counts contain no workbook content, names, identifiers or file hashes and cannot be linked back to or removed with my individual copy.";
export type ContributionReceipt =
  | { status: "not_requested" }
  | { status: "unavailable" }
  | { status: "saved"; id: string; deleteToken: string; expiresAt: string };
