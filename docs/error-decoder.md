# Walmart Error Decoder

FeedFix delivers free guidance before asking for a commercial workbook: paste an error → read an explanation → optionally inspect the XLSX. No account, credentials, Walmart connection, OAuth, API integration, payment or remote LLM. This extends FeedFix's existing acquisition flow; supported repairs and optional support remain unchanged.

## Implementation and certainty

`src/decoder/knowledge.ts` is the versioned server catalog. Every entry has a stable slug, review date, evidence location, approved official source, bounded patterns and static guidance. `src/shared/error-decoder.ts` is the public discriminated response contract. Only the matched public entry is returned; patterns, review metadata and other entries stay on the server. The small normalization/redaction helpers are shared with the browser.

Input is limited to 4,000 UTF-16 code units, validated for well-formed Unicode, normalized to NFC, stripped of controls/invisible formatting and collapsed whitespace. Matching ignores case. Pasted URLs are removed from matching and never fetched. Specific families take precedence over general validation families. Unrelated overlapping families and recognized negations return UNKNOWN. This is a conservative heuristic, not natural-language understanding; paraphrases and compound errors can remain unknown. Paste one error at a time.

- DOCUMENTED: exact documented phrase/code or a narrow documented metadata family. Confirms an interpretation, never that a particular cell is damaged.
- LIKELY_MATCH: a reviewed pattern resembles a documented family; the exact cause remains unverified.
- UNKNOWN: no reliable single interpretation. No invented steps or user-supplied source links.

Visible sections: What this means; Why Walmart is rejecting it (documented rule vs possible cause); How to fix it; Before uploading again; What we'd need the spreadsheet to verify; Source. Guidance is never gated by upload. The shared workbook CTA focuses the existing upload region. Its existing supported analysis, NEW_WALMART_TEMPLATE, UNKNOWN_SPREADSHEET and unsafe-file handling remain authoritative. No mapping or repair rule is added by the Decoder.

## Initial catalog and evidence

Official pages reviewed on 2026-09-06. Patterns are FeedFix-authored recognition heuristics, not claimed verbatim Walmart messages. Exact phrases are limited to documented headings and the published code. No fabricated codes.

| Stable entry ID | Scope | Official evidence |
| --- | --- | --- |
| missing-attribute-metadata | Required template metadata; specific pasted family can be DOCUMENTED | [Setup troubleshooting](https://marketplacelearn.walmart.com/guides/Item%20setup/Troubleshooting/troubleshoot-item-setup-errors), Missing attribute metadata |
| missing-required-attributes | Empty required attributes/fields/cells | [Full setup](https://marketplacelearn.walmart.com/guides/Item%20setup/Item%20setup%20methods/Add-items-in-bulk:-full-setup), requirement levels and Data Definitions |
| invalid-attribute-values | Invalid values without a more specific match | [Setup requirements](https://developer.walmart.com/us-marketplace/docs/get-item-setup-requirements), constraints |
| product-id | Product ID/GTIN/UPC/EAN validation; exact “Invalid product ID” heading | [Product ID troubleshooting](https://marketplacelearn.walmart.com/guides/Item%20setup/Troubleshooting/Troubleshoot-product-ID-errors); heading also in setup troubleshooting; local `src/engine/rules.ts` verifies length/checksum behavior |
| sku-reused | SKU previously associated with another product | [WFS template errors](https://marketplacelearn.walmart.com/guides/Walmart%20Fulfillment%20Services%20%28WFS%29/Troubleshooting/Troubleshoot-item-feed-errors), SKU reuse |
| variant-attributes | Group/attribute/primary-variant requirements | [Variant full setup](https://marketplacelearn.walmart.com/guides/Item%20setup/Variant%20management/Create-a-variant-group:-Full-Setup-Template) |
| image-url | Image URL accessibility and format; generic assets are not assumed to be images | [Image requirements](https://marketplacelearn.walmart.com/guides/Item%20setup/Item%20content,%20imagery,%20and%20media/Product-detail-page:-Image-guidelines-&-requirements) |
| number-format | Numeric type/range; no guessed field-specific bound | [Setup requirements](https://developer.walmart.com/us-marketplace/docs/get-item-setup-requirements) |
| inventory-date | Inventory Availability Date only, conditional on documented version | [5.0 update](https://developer.walmart.com/us-marketplace/page/item-spec-50-version-update) |
| allowed-values | Closed-list/enum rejection | [WFS template errors](https://marketplacelearn.walmart.com/guides/Walmart%20Fulfillment%20Services%20%28WFS%29/Troubleshooting/Troubleshoot-item-feed-errors), dropdown formatting |
| product-type | Category/product type and version context | [Setup requirements](https://developer.walmart.com/us-marketplace/docs/get-item-setup-requirements) |
| template-version | Spreadsheet/template/version mismatch | [Spec versions](https://developer.walmart.com/global-marketplace/docs/item-spec-versioning-and-diff-reporting); API versions do not establish XLSX support |
| invalid-feed-data | Published ERR_PDI_0034, broad data validation | [API error codes](https://developer.walmart.com/us-marketplace/docs/error-codes), feed validation |
| error-report-correlation | Report-to-workbook investigation, not a cell diagnosis | [Setup troubleshooting](https://marketplacelearn.walmart.com/guides/Item%20setup/Troubleshooting/troubleshoot-item-setup-errors), Error file; exact correlation boundary verified in `src/engine/processing-report.ts` |

Template metadata and missing attribute metadata share one entry. Missing/malformed required values use the required/invalid value families. General date errors, arbitrary asset types, unknown codes, languages other than English, account eligibility and unsupported report layouts are deliberately not diagnosed. Official API documentation is background evidence, never an instruction to connect FeedFix to Walmart.

Approved sources are fixed exact URLs in `sourceUrls`; only official Marketplace Learn / Developer pages are admitted. Before adding an entry, read the source, record the relevant section/review date, add positive and negative matching tests, and ensure scope does not imply workbook or catalog facts the text cannot establish. No sources are derived from pasted text. Slugs support future `/walmart-errors/<slug>` pages; this release creates no new SEO pages or user-content URLs. Existing indexing configuration remains unchanged.

## HTTP contracts

The existing catch-all Node route and `handle()` own both POST endpoints. Same-origin required, `application/json`, no-store responses. Request body streaming limit: 24,576 bytes (allows JSON escaping within the 4,000-character cap). Unknown extra fields are rejected. No body, request headers, IP, cookies, filename or message is logged.

`POST /api/error-decoder` accepts only `{ "message": "Missing attribute metadata" }`.

A 200 known result contains `status: DOCUMENTED | LIKELY_MATCH`, `entryId`, `slug`, `family`, `title`, `meaning`, `causes: [{certainty: DOCUMENTED | LIKELY, text}]`, `steps`, `checklist`, `sources: [{label,url}]`, `requiresWorkbook: true`, and `workbookChecks`. User input is never echoed.

A 200 unknown result is `{ "status": "UNKNOWN", "shareAvailable": true, "workbookCheckAvailable": true }`. It does not create a study record or a consent receipt.

`POST /api/error-decoder-share` accepts `{ "message": "reviewed redacted unknown text", "consent": true, "consentVersion": "unknown-error-v1" }`. It validates and reclassifies server-side, checks redaction again and stores only an unknown message whose submitted text already equals the final redacted preview. Returns 201 `{ "status": "SAVED", "expiresAt": "ISO timestamp" }`. No public read/list endpoint, workbook receipt or analytics identifier is returned.

Failures: 400 invalid/empty/over-character-limit/malformed Unicode/consent; 403 origin; 409 sharing a now-known message or text still requiring redaction; 413 byte limit; 415 content type; 429 throttling; 503 detected storage unavailability. Errors contain fixed safe text, never pasted fragments. Decode limit: 20/minute; share: 5/minute; both also use existing 90/minute general limit. Configured trusted proxy identity is used only in the in-memory rate bucket; otherwise the conservative bucket is shared. Edge must overwrite any trusted IP header. Single process/replica remains required.

## Privacy and retention

Without consent, process → respond → discard; no message persistence, browser storage, user-text URL or third-party request. The browser retains text only in component memory while explaining/reviewing it; reset, decline, successful share or leaving that surface clears it. The privacy warning appears before the textarea. Potential contacts/URLs/identifiers trigger a non-blocking warning.

UNKNOWN offers a locally generated redacted preview. The user can edit it; a separate “Text that will be stored” surface displays the final redacted text. The user must check an initially unchecked consent box and click Share reviewed message. Editing resets consent. Only that final text is submitted. The storage boundary refuses any message requiring further redaction, so stale clients or direct requests cannot bypass the preview requirement. Decline sends only a content-free analytics event. There is no automatic unknown-message save and no default consent. Successful storage is acknowledged only after the private write finishes.

Redaction removes invisible format characters before compatibility normalization (NFKC), likely emails, scheme URLs and bare domains, file-bearing clauses including names with spaces, Windows/UNC/common POSIX paths, labelled identifiers and product names, unlabelled mixed identifiers, long numbers/phones, IPv4/IPv6 patterns, and credentials including Bearer/Basic, JSON-style keys, cookies and quoted values. Recognizable ERR_ code syntax is retained for research, never treated as proof of a documented error. File clauses and credential headers are deliberately over-redacted when boundaries are uncertain. Redaction is tested for idempotence. Both normalized input and final text must remain within the size bound; expansion is rejected rather than silently truncated. This is best effort: names, unusual filenames, unlabelled IDs, obfuscation and free-form business context can survive. Accordingly, the UI says **redacted**, explicitly asks for human review and does not promise anonymity.

The separate `UnknownErrorStore` contains only reviewed/redacted message, consent version, creation and expiry. Random file names; directory 0700/files 0600; atomic rename; symlink/public/other-store boundaries; max 1,000 records and 32 KiB per record. Stored for at most 7 days while operating: expiry is 7 days minus one minute, with the existing 30-second background/startup sweeper and save-time cleanup. Corrupt records and abandoned temporary writes are purged. No raw-message analytics, workbook contents or request metadata accompany records. Recognized private text is removed before consented storage; this is still best-effort redaction of free text, not a guarantee that every possible identifier or filename can be recognized.

Set `UNKNOWN_ERROR_STORE_DIR` (default `.feedfix-errors`; Docker `/data/unknown-errors`) to a private directory separate from uploads, contributions, callbacks and metrics. Excluded from Git and Docker build context. One always-on Node instance and the existing private volume are required. No backup/snapshot or body-level proxy/APM logging of this data. An offline disk cannot be erased by an application timer: operators must purge expired entries before restoring service and enforce lifecycle deletion during downtime. Authorized review can read local unexpired JSON; never copy it into permanent fixtures or docs without separately authorized anonymization. There is no user lookup because no identity/deletion capability is retained; records expire automatically.

GA4 and Clarity script injection was removed from the root layout. A global third-party script can observe a same-document textarea even if replay masking is configured; masking alone is insufficient for the no-third-party-text requirement. Their old environment settings no longer load browser trackers anywhere, including when returning from Guides. First-party allowlisted analytics remain. Hosting-injected scripts must also be disabled by the operator. No advertising or training use.

See [analytics policy](analytics.md) and [workbook study privacy](workbook-study-copies.md) for independent retention boundaries. This error-message consent does not authorize workbook retention or template callbacks.
