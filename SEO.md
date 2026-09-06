# FeedFix search, editorial and conversion implementation

## Positioning and current operation

The public entry service explains Walmart item setup errors without an account or
file. Workbook analysis is a separate optional service: corrections require a
compatible mapping, and current compatibility requires the engine's existing
verified evidence. The hero and unified working panel remain intact.

Home title: **Walmart Item Setup Errors Explained | FeedFix**.
Description: **Understand Walmart item setup errors and what to check next. Free
explanations with official references. No account or file required.** “No file”
describes the explanation service, not workbook inspection. Preview warnings
remain in the checker and compatibility page.

Production origin is configured through `APP_URL` (intended domain feedfix.app).
Search Console and sitemap submission were already configured in the earlier
review, according to the project owner. This sprint does not repeat setup and
has not accessed the property or verified live indexing. Deployment and live URL
Inspection remain separate from local implementation.

## Approved first batch: intent hypotheses → URL

| Search problem / research query | Approved route | Distinction |
| --- | --- | --- |
| Walmart GTIN UPC invalid product ID | `/guides/walmart-gtin-upc-errors` | Format, digit count, lost zeros, checksum vs product assignment |
| Walmart missing required attribute / allowed values | `/guides/walmart-required-fields-allowed-values` | Missing facts vs wrong type vs closed-list choice |
| Walmart processing report row / error report | `/guides/walmart-processing-report` | Exact submission, unique record/field match, no guessed row offset |
| Walmart missing attribute metadata | `/guides/walmart-missing-attribute-metadata` | Template headers and added multi-select metadata |
| Walmart SKU already used / different GTIN | `/guides/walmart-sku-already-used` | Duplicate in file vs Seller Center association; WFS instructions labelled |

Queries were checked with web search on 2026-09-06. Results included official
Walmart troubleshooting and template guidance, with US and Canadian results mixed
in search. Only the relevant US workflow supports the published Walmart advice.
These are editorial intent hypotheses, not volume, difficulty, rank or competitor
traffic measurements. Five distinct problems are published; the decoder's 14
families do not automatically become pages.

## Evidence checked on 2026-09-06

- [Walmart item setup troubleshooting](https://marketplacelearn.walmart.com/guides/Item%20setup/Troubleshooting/troubleshoot-item-setup-errors): metadata instructions explicitly preserve rows 1–6; added multi-select columns need rows 4–6. Also covers upload error files and Activity Feed investigation. Row instructions are scoped to that XLSX workflow.
- [Walmart product ID troubleshooting](https://marketplacelearn.walmart.com/guides/Item%20setup/Troubleshooting/Troubleshoot-product-ID-errors): transcription and product identity; verify quantity/version, never fabricate IDs.
- [Walmart Full setup](https://marketplacelearn.walmart.com/guides/Item%20setup/Item%20setup%20methods/Add-items-in-bulk:-full-setup): Spec Product Type precedes remaining attributes and closed lists.
- [Walmart WFS template errors](https://marketplacelearn.walmart.com/guides/Walmart%20Fulfillment%20Services%20%28WFS%29/Troubleshooting/Troubleshoot-item-feed-errors): reused SKU/GTIN association, unique SKU remedy and WFS-specific tab/column. Do not generalize these positions to other templates.
- [Walmart WFS template setup](https://marketplacelearn.walmart.com/guides/Walmart%20Fulfillment%20Services%20%28WFS%29/WFS%20item%20setup/WFS-item-spec-sheet-setup?locale=en-US): checked the previously referenced WFS scope; the general field guide now uses US Full setup guidance instead.
- [GS1 check-digit calculation](https://www.gs1.org/services/how-calculate-check-digit-manually): digit structures and checksum. The previously linked calculator could not be directly retrieved with the research tool; the verified manual calculation page replaces that reference. No workbook instruction depends on an unverified calculator UI.

Explanatory comparisons and all examples are FeedFix-authored, synthetic and
labelled. They contain no contributed merchant data. Shared documented claims
are rendered from the existing decoder knowledge entries, server-side, so their
wording and approved source stay aligned. Guides add investigation logic, context
and limitations, not a second response engine. API-specific families are not
presented as Seller Center instructions.

## Editorial model and publication

`src/content-guides.ts` contains typed SEO titles, visible titles, descriptions,
context, direct answers, certainty boundaries, sections/steps, decoder families,
example IDs, approved sources, FeedFix editorial ownership, per-guide review dates,
publication status and related slugs. `publishedGuides` is the common source for
routing, index and sitemap. Review dates record the actual review above; original
publication dates are unknown and omitted. No render/build clock pretends to be
an editorial update. `published` means approved for the public route at release,
not proof that Google has indexed it.

To add a guide:

1. Check that it resolves a distinct problem rather than a synonym of an existing page.
2. Verify the official source and marketplace/workflow. Write the direct answer,
   uncertainty, ordered checks, synthetic example, unsafe edits to avoid and tool limits.
3. Add its typed record and public guide/example registry entry; keep draft content
   out of `publishedGuides` and the public registry until reviewed. Unknown slugs must 404.
4. Record the real reviewer/organization and actual review date. Add only relevant
   related links. Reuse shared decoder claims instead of copying diverging rules.
5. Run SEO, HTTP and browser checks, including no-JS reading and explicit example action.

Article JSON-LD and BreadcrumbList use the visible article data and configured
origin. Unknown publication dates, personal authors, credentials, ratings and
acceptance claims are not invented. JSON is escaped for script safety. Article
content stays in server HTML; only small action/context controls are client code.

## Navigation and preservation

The index and compact home resource list link to the five pages. Article actions
open the tool in a new tab and explain that behavior. Home resource navigation
also opens a separate tab, preserving any unsent message/selected file in the
original tool without storing private drafts. Guide CTAs carry only an allowlisted
`guide`, action (`example`, `error`, `file`) and bounded source hint.

The server validates initial public context. Unknown IDs fall back to the normal
error entry. No arbitrary redirect, raw message, filename, product ID or private
token is accepted as public context. Context never overwrites input or runs a
request. The sample runs only after Try an example; `/api/error-decoder` resolves
`example_id` from its own allowlist and labels its events as an example. A normal
request remains `{message}`. Workbook selection stays local until Analyze.

## Indexing controls

`SEO_INDEXABLE=true`, production mode and HTTPS are all required to advertise
indexable pages and a sitemap. Previews remain noindex. The sitemap has the home,
guide index, compatibility page and five approved guides (eight paths), without
query variants, drafts or private results. `force-dynamic` is preserved for runtime
configuration. Canonicals use only the configured origin and approved pathname;
metadata and JSON-LD never interpolate private query values. Tool guide/action
variants and analysis/payment-return parameters are noindex with the home canonical.

APIs preserve noindex headers and existing authorization for private downloads.
Robots allows crawling to observe noindex. Neither canonical nor noindex is access
control. A 200, sitemap entry or index tag does not prove indexing. No Indexing API,
IndexNow submission, FAQ schema campaign or llms.txt work is included.

## Measurement and verification

Run `npm run stats` on the existing metrics volume. Output now contains `corrections`
(the existing ledger) and `funnel` (daily aggregate counters). The sibling file
`USAGE_LOG_PATH + .funnel.json` persists counts even without a console adapter.
See [analytics](docs/analytics.md) for dimensions, provenance and limitations.

- Real explanations: `error_decoder_submitted`, `is_example=0`.
- Demos: the same submitted/result events, `is_example=1`, resolved by the server.
- Outcomes: documented_match, likely_match, unknown event names.
- Guide visits/actions: `guide_viewed`, `guide_tool_clicked`, approved guide and action.
- File intent: `file_selected`; actual receipt: `upload_completed`, `entry_point=analyze`.
- Verified compatible analysis: `analysis_completed`, `workbook_kind=real`, `support_verified=1`, `is_example=0`.
- New layouts and optional study: existing new_template_detected and template_share_accepted.
- Downloads/payments: existing server-confirmed events. Payment integration is unchanged;
  webhook attribution is unknown when no request-scoped context is available.

These are counts of events/requests, not unique users, linked sessions or conversion
rates. Browser metrics are best effort. Recognized paid markers take precedence;
a search-engine referrer is `search_referral`, never automatically “organic”. Full
referrers, click IDs, URLs and arbitrary UTM values are neither stored nor emitted.
No new cookies, persistent user identifiers or analytics vendor is introduced.
Local tests use isolated temporary metrics; unit funnel persistence is opt-in only
for the dedicated temporary-ledger test.

## Backlog and external follow-up

- After deployment, inspect the five URLs in the existing Search Console property,
  check the submitted sitemap and actual indexing/query data. Credentials/access
  are required; this sprint makes no claims about live indexing or positions.
- Use real queries and unknown-error demand to prioritize future image/variant/date
  guides. Leave these as editorial backlog until distinct intent and source coverage
  are established; no placeholder routes.
- Review original guide publication dates if repository/deployment history establishes
  them. Do not fill gaps with today's build date.
- Multi-instance aggregate writes need shared infrastructure or a single designated
  writer. The current metrics implementation intentionally follows the repository's
  local single-process deployment model; it is not a cross-device attribution system.

## Checks recorded for this sprint

Baseline before edits: 175 unit/integration tests and 26 E2E tests passed. Added
unit coverage for approved guides, contexts, metadata, source validation, paid
classification, server-resolved examples, privacy filtering, concurrent request
isolation and persisted aggregates. Browser coverage includes all five guides
without JavaScript, real 404s, JSON-LD, preserved original inputs and explicit
sample execution. The full E2E suite retains the development server required by
its existing mock-payment tests, with indexing explicitly disabled. Production
build pages are checked separately. No production data or real payment was used.
