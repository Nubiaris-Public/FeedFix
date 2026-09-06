# FeedFix V0 — frozen scope

## Journey
Landing → XLSX + optional report → free diagnosis, full correction details → free corrected XLSX and JSON change report → optional support through Stripe Checkout.
No account. One upload surface. Payment never unlocks data or downloads. Offer support only after generating a corrected file. Ask optionally whether Walmart accepted it: Yes / No / Haven’t tried yet. Responses are user-reported, not verified acceptance.

## Price and experiment
Corrections and downloads are free. STRIPE_PRICE_AMOUNT is the suggested voluntary support amount in integer USD cents, default 499. No subscription. Voluntary support does not require current Walmart compatibility evidence; it is available after a corrected file has been generated, including clearly labeled synthetic previews. Show that payment neither guarantees Walmart acceptance nor certifies template compatibility, both before Checkout and on Stripe. Template detection and compatibility claims remain evidence-based. Retain the short checkout window (first 15 minutes, expiry at analysis creation +45 minutes) and automatically refund payments confirmed after the temporary record expires. Downloads remain independent of payment and expire with the analysis.
Initial experiment: seek 10 real cases with a reported outcome and observe optional support. A voluntary payment validates support after receiving value, not willingness to buy a mandatory download.

## Correction log
Private persistent UTC daily totals for corrected files and applied operations, with separate real and synthetic segments. Count one successfully generated non-empty fix plan per analysis, at first XLSX download request. Repeated downloads, report-only requests, failed generation and zero-fix files do not increment. Re-uploading the same workbook creates a new analysis and can count again; this is not a unique-seller metric. Generation does not prove download delivery or Walmart acceptance.
Store only aggregate counts permanently. Hashed opaque deduplication receipts expire with the analysis, at most 59 minutes plus the 30-second sweep while running. No filenames, cells, SKUs, GTINs, IPs or tokens in the log. Optional acceptance replies can be changed during that window and affect one outcome per counted analysis. Consult with npm run stats; no admin panel or public stats endpoint.

## Supported issues
GTIN length, digits, whitespace and checksum; schema-required empty fields; declared string length; controls; URLs; declared numbers and bounds; declared enums/booleans; empty/duplicate SKUs; explicit variant group consistency. External report normalization and exact row/column or unique SKU correlation.

AUTO_FIX requires schema-authorized normalization and an unambiguous value. Checksum errors require input: mathematics alone cannot prove the correct product identifier. Missing URL protocol requires input. SKU trimming is diagnostic only because identity and collisions are risky. Unknown processing-report layouts still fail closed. Unknown workbook layouts receive an explicit identification result as described below; they never receive guessed repairs.

## Compatibility
Bundled XLSX files are synthetic, visibly marked, not Walmart schemas. Development supports them by default. Production requires a reviewed schema JSON and an official representative workbook. Do not claim Walmart acceptance or complete validation. Unsupported categories/versions fail closed. No user-supplied schema upload.

## NOT IN V0
Authentication, users, organizations, teams, dashboard, subscriptions, OAuth, Walmart APIs, other marketplaces, AI/LLMs, ticketing, email marketing, admin, translations, mobile apps, extensions, scheduled product jobs, synchronization, enrichment, optimization, SEO content, recommendations.

## Analytics
Only landing_view, file_selected, upload_completed, analysis_started, analysis_completed, issues_found, no_issues_found, checkout_started, payment_completed, corrected_file_generated, corrected_file_downloaded, analysis_failed, new_template_detected, unknown_spreadsheet_detected, template_share_offered, template_share_accepted, template_share_declined, template_notification_requested. Allowlisted numeric aggregates and file_size_bucket only. Never filenames, SKU, GTIN, titles, cell contents, merchant details, emails, sheet names, template fingerprints or bearer tokens. Analytics failures cannot fail requests. Console activity logs for landing_view and upload_completed are enabled by default via CONSOLE_ACTIVITY_ENABLED (explicit false disables them), independently of the other ANALYTICS_ENABLED funnel events. A server-generated request ID, UTC timestamp and fixed entry point form the operational envelope; no user identifiers or raw paths are included. Counts describe uploader openings and received submissions, not unique people or successful validation.

## Acceptance / commands
npm install; npm run dev; npm run lint; npm run typecheck; npm test; npm run test:e2e; npm run build.
Unit rule cases plus parser/fix preservation/security tests. Integration verifies free downloads before payment, signed optional-support webhooks, idempotent correction counts, expiry, feedback and exact changes. Browser exercises desktop/mobile upload and payment return. LCP target <1.5s, CLS near zero; measure locally, not a field-performance guarantee.

## New-template result and callback
A safely parsed XLSX with corroborating MP_ITEM marker, definitions, hidden metadata and core field headers can return `NEW_WALMART_TEMPLATE`. This is a structural candidate, not authenticated Walmart provenance, current version verification or support. Show “Walmart file detected”, explain the unsupported layout and confirm that the original was not modified. No analysis record, corrections, download or checkout is created. A safe generic workbook returns `UNKNOWN_SPREADSHEET` with honest wording; corrupt/unsafe XLSX remains an error. The browser checks extension/size only; backend security and reviewed mapping decide compatibility.

Sharing remains unchecked opt-in, using the existing private study store with a 59-minute expiry. The user can continue without sharing. After successful sharing, show “Thanks — this template is now under review”, without a delivery promise. No automatic mapping promotion occurs.

A separate optional “Notify me” action consents to a private template-specific callback request for up to 30 days. It stores only email, structural template key, declared version, consent/expiry and deletion authorization in a separate private directory on the existing volume. No account, marketing, email transport or automatic sending is introduced. Emails never enter analytics/logs. The request can be removed while the tab retains its private receipt; otherwise it expires. This is an explicit, time-limited exception to anonymous aggregate-only persistence, not a change to workbook retention. See [study/privacy operations](docs/workbook-study-copies.md).
