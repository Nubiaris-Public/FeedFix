# SEO/content/conversion sprint verification — 2026-09-06

Work used the current checkout, not audit commit `72bb8fe`. The working tree was
clean before this sprint. No commit, remote change, production deployment, real
merchant file or real payment was used.

## Executed checks

| Check | Observed result |
| --- | --- |
| Baseline `npm test` | 175 tests, 16 files passed |
| Baseline `npm run test:e2e` | 26 passed |
| Final `npm run lint` | Exit 0 |
| Final `npm run typecheck` | Exit 0 |
| Final `npm test` | 182 tests, 18 files passed |
| Final `npm run build` | Exit 0; dynamic home, guides, sitemap and robots retained |
| Final `npm run test:e2e` | 32 passed, desktop 1440×900 and mobile 390×844 |
| Local production Chromium smoke | Both viewports: guide HTTP 200, explicit demo DOCUMENTED, no page/console errors or horizontal overflow |
| `npm run --silent stats` with isolated E2E usage path | Exit 0; persisted demo/manual-query and synthetic-analysis dimensions verified |
| `git diff --check` | Exit 0 |

The expanded development suite initially encountered one transient homepage HTTP
500 in the mobile HTML-input test (31 passed). An exploratory run of the complete
suite against a production server passed 30 tests but failed the two existing
mock-payment UI tests: that UI is development-only. Payment protections were not
changed. The final full run retained the existing development-server contract and
passed all 32 tests. A separate successful production-build smoke checked the
content and guide-to-example journey without payments.

The local `next start` smoke emitted Next's existing standalone-output launcher
warning. This was a local check, not a change to the deployment launcher. The
browser sandbox required execution permission; Chromium then completed normally.

## Coverage and evidence

New tests: `tests/seo-sprint.test.ts`, `tests/funnel.test.ts`,
`e2e/seo-sprint.spec.ts`. Existing SEO, analytics/privacy and HTTP assertions were
updated for the new bounded dimensions; their private-data exclusions remain.

Coverage includes five approved guides, unique metadata/canonicals, source and
context allowlists, per-entry editorial review dates, Article/Breadcrumb JSON-LD,
preview indexing restrictions, private metadata, unknown-context fallback,
server-resolved demo classification, request-context isolation, persisted counts,
no-JavaScript articles, real 404s, explicit example execution and preservation of
an unsent message and selected synthetic file in the original tab.

Playwright saves `guide.png` and `guide-to-tool.png` for each viewport under its
`test-results/seo-sprint-guide-to-*` directories. Separate production captures and
machine-readable smoke results were generated in `/tmp/feedfix-seo-evidence/`.
These are local test artifacts, not fabricated Seller Center screenshots.

`/tmp/feedfix-seo-stats.json` contains aggregates accumulated over local test runs:
manual-message requests have `is_example=0`; approved sample requests have
`is_example=1`, including the metadata guide ID; completed fixture analyses have
`workbook_kind=synthetic` and `is_example=1`. These counts are test evidence, not
customer usage or conversion rates. See `docs/analytics.md` for named-row queries
and the three required filters for verified compatible real analyses.

## Remaining external verification

Deployment remains unauthorized. Existing Search Console property/sitemap state,
Google indexing, query performance and live traffic were not verified. No search
volume, ranking or customer-acquisition claim follows from these checks.

Metrics use the existing local single-writer storage model; multiple writers or
instances require shared infrastructure. Counts are events, not unique users.
No-JavaScript readers do not emit browser analytics. Referrer stripping or missing
campaign markers can make attribution unknown. Original publication dates remain
omitted where unverified. The repair engine, supported mappings, Stripe, workbook
retention and optional research consent were not changed.
