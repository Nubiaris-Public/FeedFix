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
