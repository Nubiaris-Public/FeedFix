/** Product identification is separate from schema validation and analysis state. */
export type UnsupportedUpload = {
  status: "NEW_WALMART_TEMPLATE" | "UNKNOWN_SPREADSHEET";
  walmartDetected: boolean;
  supported: false;
  modified: false;
  studyShareAvailable: boolean;
  checkoutAvailable: false;
};
export const NOTIFICATION_CONSENT_VERSION = "template-notification-30d-v1";
export const NOTIFICATION_RETENTION_DAYS = 30;
