# FeedFix V0 — frozen scope

## Journey
Landing → XLSX + optional report → free diagnosis, full correction details → free corrected XLSX and JSON change report → optional support through Stripe Checkout.
No account. One upload surface. Payment never unlocks data or downloads. Offer support only after generating a corrected file. Ask optionally whether Walmart accepted it: Yes / No / Haven’t tried yet. Responses are user-reported, not verified acceptance.

## Price and experiment
Corrections and downloads are free. STRIPE_PRICE_AMOUNT is the suggested voluntary support amount in integer USD cents, default 499. No subscription. Retain the short checkout window (first 15 minutes, expiry at analysis creation +45 minutes) and automatically refund payments confirmed after the temporary record expires. Downloads remain independent of payment and expire with the analysis.
Initial experiment: seek 10 real cases with a reported outcome and observe optional support. A voluntary payment validates support after receiving value, not willingness to buy a mandatory download.

## Correction log
Private persistent UTC daily totals for corrected files and applied operations, with separate real and synthetic segments. Count one successfully generated non-empty fix plan per analysis, at first XLSX download request. Repeated downloads, report-only requests, failed generation and zero-fix files do not increment. Re-uploading the same workbook creates a new analysis and can count again; this is not a unique-seller metric. Generation does not prove download delivery or Walmart acceptance.
Store only aggregate counts permanently. Hashed opaque deduplication receipts expire with the analysis, at most 59 minutes plus the 30-second sweep while running. No filenames, cells, SKUs, GTINs, IPs or tokens in the log. Optional acceptance replies can be changed during that window and affect one outcome per counted analysis. Consult with npm run stats; no admin panel or public stats endpoint.

## Supported issues
GTIN length, digits, whitespace and checksum; schema-required empty fields; declared string length; controls; URLs; declared numbers and bounds; declared enums/booleans; empty/duplicate SKUs; explicit variant group consistency. External report normalization and exact row/column or unique SKU correlation.

AUTO_FIX requires schema-authorized normalization and an unambiguous value. Checksum errors require input: mathematics alone cannot prove the correct product identifier. Missing URL protocol requires input. SKU trimming is diagnostic only because identity and collisions are risky. Unknown reports/templates are rejected with useful instructions.

## Compatibility
Bundled XLSX files are synthetic, visibly marked, not Walmart schemas. Development supports them by default. Production requires a reviewed schema JSON and an official representative workbook. Do not claim Walmart acceptance or complete validation. Unsupported categories/versions fail closed. No user-supplied schema upload.

## NOT IN V0
Authentication, users, organizations, teams, dashboard, subscriptions, OAuth, Walmart APIs, other marketplaces, AI/LLMs, ticketing, email marketing, admin, translations, mobile apps, extensions, scheduled product jobs, synchronization, enrichment, optimization, SEO content, recommendations.

## Analytics
Only landing_view, file_selected, upload_completed, analysis_started, analysis_completed, issues_found, no_issues_found, checkout_started, payment_completed, corrected_file_generated, corrected_file_downloaded, analysis_failed. Allowlisted numeric aggregates and file_size_bucket only. Never filenames, SKU, GTIN, titles, cell contents, merchant details or bearer tokens. Analytics failures cannot fail requests.

## Acceptance / commands
npm install; npm run dev; npm run lint; npm run typecheck; npm test; npm run test:e2e; npm run build.
Unit rule cases plus parser/fix preservation/security tests. Integration verifies free downloads before payment, signed optional-support webhooks, idempotent correction counts, expiry, feedback and exact changes. Browser exercises desktop/mobile upload and payment return. LCP target <1.5s, CLS near zero; measure locally, not a field-performance guarantee.
