# FeedFix V0 — frozen scope

## Journey
Landing → XLSX + optional report → free analysis → safe fix count → one-time Stripe Checkout → verified webhook → corrected XLSX + JSON change report.
No account. English UI, compact mobile-first utility, light background, one upload surface. Free results include row/column, rule and actionable diagnosis; exact before/after operations are paid. No fixable issues means no checkout.

## Price
STRIPE_PRICE_AMOUNT is integer USD cents, default 499. One corrected file, no recurring billing. Downloads expire with the analysis; clearly show the expiry before checkout. Checkout starts only in the first 15 minutes of a 60-minute analysis, and lasts 30 minutes. Refund a confirmed payment if the analysis expired before fulfillment.

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
Unit rule cases plus parser/fix preservation/security tests. Integration verifies denial before payment, signed mocked Stripe webhook, idempotency, exact changes and downloads. Browser exercises desktop/mobile upload and payment return. LCP target <1.5s, CLS near zero; measure locally, not a field-performance guarantee.
