export const MAX_ERROR_CHARACTERS = 4000;
export const UNKNOWN_CONSENT_VERSION = "unknown-error-v1";
// Strip controls and invisible formatting, retaining ordinary line/word boundaries.
export function normalizeMessage(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > MAX_ERROR_CHARACTERS ||
    !value.isWellFormed()
  )
    throw new Error("Paste between 1 and 4,000 characters of plain text.");
  const text = value
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!text || text.length > MAX_ERROR_CHARACTERS)
    throw new Error("Paste between 1 and 4,000 characters of plain text.");
  return text;
}
/** Best effort only. Prefer losing a clause to retaining part of a private value.
 * Pure and idempotent: the browser previews exactly what the server can store.
 */
export function redactMessage(value: string): string {
  normalizeMessage(value); // Validate the original size before removing obfuscation.
  let text = normalizeMessage(value.replace(/\p{Cf}/gu, "").normalize("NFKC"));
  text = text
    .replace(
      /\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*["']?\s*:[\s\S]*/giu,
      "[credential]",
    )
    .replace(/\b(?:bearer|basic)\s+[a-z0-9+/_.=-]+/giu, "[credential]")
    .replace(
      /\b(?:token|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|password|secret|api[_ -]?key|access[_ -]?key|session[_ -]?id|sku|gtin|upc|ean|isbn|product\s*(?:id|name|title)|merchant\s*(?:id|name)|seller\s*(?:id|name)|filename|file\s*name|file|workbook|spreadsheet|attachment)\s*["']?\s*[:=#]\s*(?:"[^"\n]*"|'[^'\n]*'|[^;,\n]*)/giu,
      "[redacted]",
    )
    .replace(/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/gu, "[email]")
    .replace(/(?:[a-z][a-z0-9+.-]{1,20}:\/\/|www\.)[^\s<>]+/giu, "[url]")
    .replace(
      /[^\[\];\n]*(?:[a-z]:\\|\\\\|\/(?:home|users|tmp|var|data|mnt)\/)[^\[\];\n]*/giu,
      "[file]",
    )
    .replace(
      /[^\[\];\n]*\.(?:xlsx?|xlsm|xlsb|csv|tsv|pdf|json|zip|png|jpe?g|webp|docx?|txt)\b/giu,
      "[file]",
    )
    .replace(
      /\b[a-z0-9](?:[a-z0-9-]*\.)+[a-z]{2,24}(?:[/:?#][^\s<>]*)?/giu,
      "[url]",
    )
    .replace(
      /\b(?:sku|gtin|upc|ean|isbn|product\s*id|merchant\s*id|seller\s*id)\s+(?=[\w-]*\d)[\w-]+/giu,
      "[identifier]",
    )
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/gu, "[address]")
    .replace(/\b[a-f0-9]*:[a-f0-9:]*:[a-f0-9:]*\b/giu, "[address]")
    .replace(/\+?\d[\d ().-]{8,}\d/gu, "[number]")
    .replace(/\b\d{8,}\b/gu, "[number]")
    .replace(/\b[a-z0-9][a-z0-9_-]{5,}\b/giu, (token) => {
      // Retain recognizable diagnostic code syntax, never assert its interpretation.
      if (/^ERR_[A-Z0-9_]{1,64}$/i.test(token)) return token;
      return /[a-z]/i.test(token) && /\d/.test(token) ? "[identifier]" : token;
    });
  // Redaction can expand a short token into a placeholder. Never silently truncate.
  return normalizeMessage(text);
}
