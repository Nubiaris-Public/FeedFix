# FeedFix analytics

`src/server/analytics.ts` is the event/property allowlist and failure-isolated adapter. `ANALYTICS_ENABLED=true` enables server funnel logs; `CONSOLE_ACTIVITY_ENABLED` independently defaults on for landing_view/upload_completed operational counts. Neither feature sends message text to a browser tracking vendor. Root-layout GA4/Clarity injection is removed for Decoder privacy; the legacy ID variables are inert.

Existing upload, correction, optional support and template events retain their semantics. The Decoder adds:

| Event | Emission |
| --- | --- |
| error_decoder_viewed | Client component mount on the landing |
| error_decoder_submitted | Server accepts a valid decode request |
| error_decoder_documented_match | Server returns DOCUMENTED |
| error_decoder_likely_match | Server returns LIKELY_MATCH |
| error_decoder_unknown | Server returns UNKNOWN |
| error_decoder_workbook_cta | User selects the existing uploader link |
| error_decoder_unknown_share_offered | Server returns the unknown sharing option |
| error_decoder_unknown_share_accepted | Private consented storage succeeds |
| error_decoder_unknown_share_declined | User explicitly declines |

Counts are interactions, not unique sellers. Offered means the API returned the option, not proven viewport exposure. Views count mounts, not scroll exposure. No identity/session/funnel linkage is persisted by the Decoder.

Decoder events drop all existing numeric fields and arbitrary properties. Only a catalog-validated `entry_id`, its derived `error_family`, and enum `confidence` may be emitted for server matches. Browser event requests can emit only viewed/workbook_cta/share_declined and cannot set dimensions. IDs/families are fixed catalog strings, never pasted codes or derived merchant identifiers. Unknown and sharing events are property-free. Never log raw errors, messages, SKU, GTIN, email, filename, product name, workbook values, URL, template data, request headers or user-defined text. The envelope has only the existing random per-request ID, fixed entry point, timestamp and event; this ID is not stored with error study messages.

Sync throws and async adapter rejections are swallowed and tested. Metrics failure cannot change guidance, consent storage or XLSX fulfillment. Reviewed unknown messages belong only to the separate 7-day private study store described in [error-decoder.md](error-decoder.md), never aggregate analytics or stdout. Configure infrastructure logs accordingly.

The hardened reviewed-text flow does not add analytics properties. Preview text and redaction results remain excluded, including when sharing is rejected for requiring further redaction.

## SEO sprint: private, persistent aggregate funnel

This section supersedes the earlier property-free decoder-event description.
Existing allowlists remain; added dimensions are validated `guide_id`, bounded
`source`, server-owned `is_example` (0/1), `workbook_kind` (real/synthetic), and
`support_verified` (0/1 on server analysis_completed). Decoder entry/family values
still come from the catalog. `guide_tool_clicked` permits only action
example/error/file. Browser clients cannot emit upload/analysis/payment completion.
The aggregate key also records the existing bounded request entry point, separating
analysis receipts from study reuploads. No merchant-derived strings are allowed.

`src/server/funnel.ts` writes daily counts to `USAGE_LOG_PATH + .funnel.json`, beside
the existing usage ledger. `npm run stats` reads both. A single in-process queue
serializes atomic replacements (0700 parent / 0600 file); the HTTP boundary drains
pending writes. Failed metrics do not fail the request. No raw event stream,
request IDs, IPs, cookie values, auth headers, filenames or messages enter this file.
Only 90 days of aggregate day buckets are retained, pruned on subsequent writes.
Queue/counter-cardinality limits prevent unbounded growth; at capacity or storage
failure some events may be lost. This is single-writer local storage, not a durable
multi-instance analytics service. Console activity flags still control console
output independently of these aggregate metrics, as with the existing usage log.

The key dimension order is supplied by `npm run stats` in `funnel.dimensions`:
event, guide_id, source, is_example, entry_id, workbook_kind, entry_point, action,
support_verified. Missing context uses none/unknown. A browser selection has not
yet established workbook provenance. For verified current compatible analysis,
require analysis_completed + real + support_verified=1 + is_example=0; non-synthetic
alone is insufficient. Synthetic compatible analyses have is_example=1 and
workbook_kind=synthetic. Local E2E counts live only under `/tmp` paths configured
by Playwright; unit tests write only in the explicitly enabled temporary-ledger test.

Guide views are client effects protected against duplicate rerenders. Views with
JavaScript disabled are not counted; articles remain fully readable. User retries
are separate requests, not deduplicated users. Existing correction/payment state
retains its own idempotency. Downloads count server responses rather than proof
of browser receipt. No persistent identifier was added to join visits, uploads
and payments. Do not calculate a person-level conversion rate from these counts.

Attribution is bounded and per request through AsyncLocalStorage. Known click
marker presence or paid-medium values classify paid without retaining the marker.
Search-engine referrers classify search_referral, not organic. Missing/stripped
or same-origin referrers are unknown. Approved source hints can accompany guide
navigation but are client-reported and not proof of acquisition. No full referrer,
query string or click ID is saved. Webhooks usually have unknown guide/source;
Stripe and payment processing were not changed. Mock payment tests remain local.

`funnel.rows` exposes named fields for querying without parsing aggregate keys.
For example, after `npm run --silent stats > stats.json`:

```sh
jq '.funnel.rows[] | select(.event == "error_decoder_submitted") | {is_example, guide_id, source, count}' stats.json
jq '.funnel.rows[] | select(.event == "analysis_completed" and .workbook_kind == "real" and .support_verified == 1 and .is_example == 0)' stats.json
jq '.funnel.rows[] | select(.event == "upload_completed" and .entry_point == "analyze")' stats.json
```

The first query separates explicit examples from submitted messages. The second
requires verified current support, not merely successful parsing. These commands
read local aggregates; they neither call Walmart nor perform payments/uploads.
