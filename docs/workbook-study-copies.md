# One-hour private workbook study copies

Users can opt in, with an unchecked checkbox, to a private copy of the original workbook for structure review. The recorded consent is `workbook-study-1h-v2`. Sharing is independent of analysis/payment and is not required to use FeedFix. No AI training, publication, permanent fixture ingestion or automatic compatibility promotion is performed.

The multipart analyze request includes `studyConsent` only after opt-in. The server validates the XLSX package, copies its original bytes, then attempts normal template detection and analysis. This order preserves useful unknown layouts even when the schema adapter cannot analyze them. Unsafe archives, macros, external links and invalid workbooks retain the existing rejection rules. Optional processing reports are not copied into study storage. Storage failures do not block analysis, and the client is told when its study copy was not saved.

Each private record has an opaque random ID, the exact original XLSX, SHA-256, byte count, capture/expiry timestamps, versioned consent text and a hashed deletion token. Original filenames, IPs and extra user identifiers are not retained. Every copy starts as `UNKNOWN` / `PENDING`; schema version stays unknown until review. Uploading a file does not establish that it is an original current Walmart template. No schema compiler, fixture harness or payment gate consumes these copies automatically.

Retention is fixed in code at 59 minutes, leaving margin for the background sweep every 30 seconds. Both the original and its metadata are removed. Expired copies are also purged before list, inspect, save and delete operations. A user can delete early using the response's private token and the "Delete study copy now" button; closing the tab loses this early-deletion receipt, but does not extend retention. No public listing, viewing or download endpoint exists for study copies. The deletion endpoint requires the token and the existing same-origin check. No tokens appear in URLs.

Storage defaults to `.feedfix-study`, or `/data/study` in the production Docker image. It is separate from the expiring analysis records. Directories are created with mode 0700 and files with mode 0600; broad roots, public/temporary overlap and symlinked paths are refused. Git and Docker exclude the local study folder. The production entrypoint initializes `/data/study` on the private persistent volume. Do not include study storage in backups/snapshots or configure a public directory. A stopped process cannot perform deletion: the always-on single-instance deployment and startup cleanup remain required. Monitor `study_cleanup_failed` / `study_copy_unavailable`; no workbook contents are logged in these events. Hard deletion deadlines during host outages require an independent storage lifecycle service; this implementation does not claim to supply one.

Default capacity is 50 files and 256 MiB, adjustable through `CORPUS_MAX_FILES` and `CORPUS_MAX_MB`. `CORPUS_STORE_DIR` sets the private location. The retention duration is not configurable upwards. HTTP writes/deletes share the existing single-instance mutation queue; do not run multiple application replicas against this filesystem.

Local operator commands:

```sh
npm run walmart:uploads -- list
npm run walmart:uploads -- inspect <id>
npm run walmart:uploads -- cleanup
npm run walmart:uploads -- feedback
```

The list contains capture IDs, hashes, sizes, origin and expiry only. Inspect returns the structural study described below without dumping product-row values. These are local administrative commands, not API routes. While a copy exists, an authorized operator can study `CORPUS_STORE_DIR/<id>/original.xlsx` on the private host. Do not export it into permanent fixtures, logs or reports; all copies and workbook-specific study material must respect the one-hour limit.

The Docker runtime maps `npm run walmart:uploads -- list` (and the other subcommands) to its bundled CLI, so it does not require development dependencies such as `tsx`. Local development continues to use the TypeScript source. Older images with the original npm script can invoke the bundled CLI directly:

```sh
node study-uploads.cjs list
node study-uploads.cjs inspect <id>
node study-uploads.cjs cleanup
node study-uploads.cjs feedback
```

Checks cover no-consent behavior, exact-byte preservation, permissions, consent metadata, UNKNOWN provenance, authorized deletion, capacity, expiration, corrupt receipt cleanup, private-path restrictions and receipt delivery on unsupported-template errors. Browser tests exercise opt-in and early deletion on desktop/mobile. This change prepares the code and container configuration; it does not deploy the service.

Verification executed: 98 Vitest tests passed across 11 files, eight Playwright tests passed across desktop/mobile, TypeScript/ESLint/production build passed, and the bundled operator CLI ran successfully. The final browser run reported no captured page/console errors. `git diff --check` passed. No deployment was performed.

## Automatic structural study

Every newly consented, safely parsed upload produces a private `study.json` before the capture is published, including unsupported layouts. It records source SHA-256, ordered sheet names/visibility, formula/merge/validation/table counts, defined-name count and hashes of package members for later integrity comparisons. A recognized `Version=5.0.<date>-<time>,MP_ITEM` marker enables candidate column extraction from rows 4–5 and a count of populated rows after row 6. This is a layout heuristic, not a reviewed mapping. Column output is limited to 512 entries and 160 characters per label, with explicit truncation flags. Unknown layouts still receive a structural inventory.

No product-row values, formula expressions or list contents are copied into the report. Sheet names and candidate headers are still untrusted workbook-derived content and may contain sensitive text. The report stays private with mode 0600 and is deleted with the original on early deletion, expiration or failed capture. It is not returned by the upload API or consumed by support/payment gates. No external service or LLM is called. Inspection recomputes the report after checking the original hash, allowing older captures to be inspected without writing files or extending retention.

Authenticity remains `NOT_VERIFIED`, schema compatibility `NOT_EVALUATED`, repair `NOT_ATTEMPTED`, and origin `UNKNOWN`. Automatic study does not compare arbitrary headers to the API schema, certify provenance or attempt ambiguous repairs. Operators use `node study-uploads.cjs inspect <id>` to read the study within its retention window. Permanent mapping changes still require review and independent synthetic tests; this report is not a permanent training corpus.

## Persistent improvement feedback (v2 consent)

V2 consent explicitly permits persistent aggregate structural counts after the original and its report expire. Existing v1 copies remain readable/deletable but are never retroactively aggregated; new submissions must accept v2. The upload checkbox uses the updated shared consent text.

After a successful capture, the single-instance mutation queue updates private `feedback.json` in the study root. This file is deliberately excluded from per-copy expiration. Its strict schema contains only a format version, total accepted uploads and fixed counters for candidate/unknown layouts, hidden sheets, formulas, validations, merges, tables, defined names and truncated column inspection. No IDs, timestamps, hashes, versions declared by uploads, arbitrary labels, product data or per-file records are retained. These counters cannot be linked back to an individual copy or removed by its deletion token. They count submissions, not distinct users or verified Walmart workbooks; repeated uploads can influence priorities.

The `feedback` CLI ranks fixed engineering proposals by observed frequency. All proposals require review, compiled-schema verification where applicable, and independent synthetic regression tests before implementation. It does not generate production mappings, modify validators, establish current Walmart provenance or enable payment/support gates. Relevant temporary studies must still be reviewed before expiry when detailed mapping evidence is needed. This is persistent prioritization memory, not autonomous learning or a permanent workbook corpus.

Updates use atomic replacement; malformed stored counters are not silently reset. `study_feedback_failed` reports a generic aggregation failure without exposing workbook contents and does not discard the user's successfully saved study copy. Feedback is best effort: a process interruption between capture and aggregate update can undercount. A subsequent update removes a stale pending aggregate file before retrying; pending content also consists solely of the fixed counters. The existing private persistent volume keeps feedback across deployments. CLI inspection/listing never increments counters.

## Automatic engineering checks

After aggregate update, each accepted upload automatically runs a bounded suite selected from fixed structural counters. The suite creates independent, tiny synthetic XLSX packages from code constants; uploaded bytes, names, fields and values never enter these fixtures. Baseline plus observed hidden-sheet, formula, validation, merge, table and defined-name cases exercise the existing parser, validator, correction planner, surgical patcher, integrity comparator and revalidation. Each case requires one known whitespace repair, preserves an ambiguous enum for review, and checks byte-identical output on a second no-op repair.

Private `synthetic-checks.json` retains only probe version, fixed feature identifiers, SYNTHETIC provenance, PASS/FAIL and a fixed execution stage. It survives workbook expiry because it contains solely independently generated test results. `feedback` re-runs the suite on the currently installed code, ranks failed feature checks first, exposes untested areas explicitly and supplies reproduction commands and acceptance criteria. Generic `study_synthetic_probe_failed` indicates an automatic test failure. Runtime cost is bounded to seven small cases per capture; no code generation, external service, LLM, heavyweight schema compilation or deploy is invoked.

Reproduce a specific case with `node study-uploads.cjs probe hiddenSheets` (or `npm run walmart:uploads -- probe hiddenSheets`); failed probes exit nonzero. Allowed cases are baseline, hiddenSheets, formulas, validations, merges, tables and definedNames. Each package is deterministic and can be reproduced with `syntheticStudyFixture` for a development regression test. These probes exercise the existing synthetic validator mapping, not official Walmart field validation. They do not establish that every uploaded structural variant is covered. Unknown/candidate layouts and truncated column inspection remain explicit coverage gaps requiring reviewed adapters; combinations of structural features are not covered by these individual cases.

This closes automatic diagnosis and reproducible-test preparation. It does not write production code, approve new mappings or deploy improvements. Those remain reviewed changes with the repository and golden harness checks, and current Walmart evidence remains independently required for compatibility claims.
