# Error Decoder verification — 2026-09-06

Implemented in the current FeedFix workspace without commit, push or deployment. The initial working tree was clean. User-supplied product requirements served as the feature specification. Inspection covered landing, uploader, analysis/repair, NEW_WALMART_TEMPLATE, workbook study copies, optional callbacks, supported mappings, analytics, tests and the product/architecture/Walmart documentation. Relevant installed Next 16.3.4 App Router and client component guides were read before code changes.

## Executed final checks

| Command | Result |
| --- | --- |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 175 tests in 16 files |
| `npm run build` | Exit 0; production Next build and TypeScript |
| `npm run test:e2e` | Exit 0; 24 desktop/mobile cases, final run 52.5 s |
| `npm run walmart:golden` | Exit 0; 7 SYNTHETIC goldens, including compiled schema-27 and package integrity |
| `git diff --check` | Exit 0 |
| `sh -n docker/entrypoint.sh` | Exit 0 |

46 new Vitest cases cover catalog families, exact/case/whitespace matching, specificity and overlap, unknown/negation, input limits/Unicode, approved-source boundaries, redaction, POST contracts, consent, non-persistence, permissions, expiry, private/symlink storage, HTTP malformed/byte/character limits, origins, rate limiting and failure-isolated analytics. Four new Playwright scenarios run on each device (8 added cases): guidance before upload and existing analysis, unknown decline/consent/save, XSS/third-party/analytics isolation, and uncertainty/accessibility. Existing support/download/new-template/SEO cases also passed. The SEO H1 expectation was updated to the intended new product heading; no tests were skipped or disabled.

Failures observed and resolved: initial matcher test import failed before implementation; a negative scope test caught generic video asset URLs being classified as images and the rule was narrowed. First full browser run had 22 passes and two obsolete H1 expectations; both were corrected and complete subsequent suites passed. Initial sandbox Playwright startup and tsx golden IPC were refused; authorized runs outside the sandbox succeeded. Warnings about NO_COLOR/FORCE_COLOR were emitted. There was no production deployment or real Seller Center roundtrip.

The compiler, engine, compiled artifacts, mappings and fixtures have no diff. The large source-to-compiled schema verification was not rerun because these boundaries were unchanged; do not interpret the synthetic golden PASS as real Walmart workbook acceptance.

## Local production performance (initial implementation, before privacy hardening)

A read-only `git archive HEAD` baseline was built in `/tmp/feedfix-decoder-baseline`, with the same installed dependencies. Both production builds ran on local ports, with third-party IDs disabled in both environments. Chromium used fresh desktop/mobile contexts, three runs per combination, no CPU/network throttling, and a 1.2-second observation after load. These are laboratory samples, not field Core Web Vitals or physical-device measurements.

| Viewport | Baseline median LCP | Decoder median LCP | Baseline CLS | Decoder CLS |
| --- | --- | --- | --- | --- |
| desktop | 44 ms | 84 ms | 0 | 0 |
| mobile | 36 ms | 72 ms | 0 | 0 |

Decoded script resources: 473,139 → 481,199 bytes (+8,060 bytes, about 1.7%; not compressed transfer size). No horizontal overflow in any of the 12 samples. Both sampled LCPs are below the existing 1.5 s lab target. Search of `.next/static` found no internal catalog evidence/matcher source markers. No dependencies were added.

The first measurement waited for networkidle and timed out on the baseline: Next route prefetches remain pending. The successful comparison used load plus a fixed observation window for both builds; pending prefetch requests were aborted when contexts closed. `next start` emitted the existing standalone-output recommendation; deployment continues to use the Docker standalone server. No claim of zero runtime network warnings or real-world performance is made. Production visual inspection found stale CSS in the first cached build despite build success. Moving the generated build cache to `/tmp/feedfix-decoder-stale-build-cache` and rebuilding restored the actual source styles. The clean sandbox build encountered a TypeScript --showConfig parse failure; the authorized clean build outside the sandbox passed. Final measurements above replace the stale-style samples and assert computed textarea display:block on every Decoder visit. No source-code or dependency change was needed for this cache issue.

Artifacts: `/tmp/feedfix-decoder-performance.json`, `/tmp/feedfix-decoder-perf.mjs`, `/tmp/feedfix-decoder-production-{desktop,mobile}.png`, `/tmp/feedfix-decoder-known-{desktop,mobile}.png`, `/tmp/feedfix-decoder-unknown-{desktop,mobile}.png`. Captures were visually reviewed for the mobile landing and documented result.

## Privacy hardening follow-up

The follow-up adds 19 adversarial/unit/integration cases and strengthens the existing desktop/mobile consent scenario. Thirteen new assertions initially failed against the former redactor, exposing filenames with spaces, complete paths, cookies, Bearer tokens, quoted values, Unicode obfuscation and unlabelled identifiers. The implemented redaction passes all of them, with idempotence assertions and a post-normalization size bound. Additional cases cover JSON header keys, accessToken, unusual labelled filenames and eight-digit identifiers.

The UI now displays a separate final storage preview; editing resets consent. Only its final text is posted. Both HTTP and the store reject text still requiring redaction with no write (HTTP 409), preventing a direct caller or stale client from silently storing a differently sanitized message. Integration tests verify the stored message equals the reviewed string. First-party analytics, 7-day TTL and no-consent non-persistence remain unchanged.

All five required checks were rerun successfully for the hardened code: lint/typecheck/build exit 0, 175 Vitest tests and 24 Playwright cases. The build used a fresh generated cache. The source/mapping/golden boundaries were unchanged by this follow-up, so the prior seven-golden result above was not rerun. A separate production Chromium smoke passed on desktop and mobile, verifying computed textarea/preview styles, submitted-preview equality, successful sharing, no page errors and no horizontal overflow. Script: `/tmp/feedfix-decoder-hardening-qa.mjs`; captures: `/tmp/feedfix-decoder-hardening-{desktop,mobile}.png`; synthetic study records isolated in `/tmp/feedfix-decoder-hardening-qa-errors`. The earlier performance byte/LCP figures are historical and were not remeasured for this follow-up.

This remains conservative best-effort free-text redaction. It may remove useful diagnostic clauses and cannot guarantee recognition of arbitrary names, unusual obfuscation or identifiers disguised as error codes. Human privacy review remains necessary; anonymity is not promised. No catalogue families or third-party tracking were added in this follow-up.

## Review and outstanding limits

The deterministic catalog, API, source and privacy contracts are in [error-decoder.md](error-decoder.md); the event allowlist is in [analytics.md](analytics.md). Global GA4/Clarity injection is intentionally removed because same-document third-party scripts could observe the pasted input. Their legacy environment settings are inert; first-party server analytics and XLSX optional support remain.

Remaining operational requirements: one always-on process, private separate error-study storage, no backups or request-body/APM logging, edge control of trusted proxy headers, and deletion lifecycle while the service is offline. Free text cannot be guaranteed anonymous despite best-effort redaction and explicit human review. Only English catalog families are recognized; generic dates/non-image assets and ambiguous multiple errors remain UNKNOWN. No new SEO routes were created; stable slugs and existing noindex configuration are preserved. Docker syntax was checked; no Docker image was built in this task.

## Literal git diff --stat

This command reports tracked files only; new files remain intentionally unstaged.

```text
 .dockerignore                      |   3 +
 .env.example                       |   9 +--
 .gitignore                         |   4 +-
 ARCHITECTURE.md                    |   9 ++-
 Dockerfile                         |   2 +-
 PRODUCT.md                         |  11 +++-
 README.md                          |  15 +++--
 docker/entrypoint.sh               |   6 +-
 docs/walmart-schema-integration.md |   3 +
 docs/workbook-study-copies.md      |   5 ++
 e2e/seo.spec.ts                    |   2 +-
 playwright.config.ts               |   1 +
 src/app/globals.css                | 124 +++++++++++++++++++++++++++++++++++++
 src/app/layout.tsx                 |  31 +---------
 src/app/utility.tsx                |  15 +++--
 src/server/analytics.ts            |  24 +++++++
 src/server/http.ts                 | 123 ++++++++++++++++++++++++++++++++++--
 src/server/store.ts                |   4 ++
 18 files changed, 332 insertions(+), 59 deletions(-)
```

New files (in addition to this verification report):

```text
docs/analytics.md
docs/error-decoder.md
e2e/decoder.spec.ts
src/app/error-decoder.tsx
src/decoder/input.ts
src/decoder/knowledge.ts
src/server/unknown-errors.ts
src/shared/error-decoder.ts
tests/decoder-http.test.ts
tests/decoder.test.ts
```
