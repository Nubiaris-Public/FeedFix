# Walmart schema integration

## Discovery and implementation contract

The existing engine lives in `src/engine`: Zod MarketplaceSchema/FieldDefinition, explicit worksheet marker/header mappings, pure field rules, XML-based workbook parsing, surgical cell patching, and CSV/XLSX report correlation. `src/server/service.ts` owns analysis/download, with temporary records and Stripe support in separate modules. Vitest and Playwright cover synthetic fixtures and provider mocks. Reuse these boundaries rather than replace the application.

The source found at `src/5.0.20260703-18_22_27-api_MP_ITEM_0_0_en.json` is 451,013,258 bytes. Its header declares draft-07 and version `5.0.20260703-18_22_27-api`. It specifies an API feed, not Excel column coordinates. All six existing workbook fixtures are synthetic; no legacy/current real workbook was found.

Build order: streaming inspector/compiler/independent verifier → compiled runtime and explicit workbook adapters → structural verification and golden harness → evidence gates and full validation. The user's 13 phases and acceptance criteria are the implementation specification. No automatic promotion of fixture origin, no source artifact in Git/Docker/browser, and no inferred workbook compatibility are allowed.

The compiler normalizes JSON containers into a content-addressed graph, sharing repeated field/enum/rule definitions across product types. Canonical source pointers remain traversable. Only schema description/examples annotations may be omitted with an audit reason; validation keywords, unknown metadata and references must remain exact. Runtime reads bounded compiled shards and materializes only an explicitly selected product schema plus common item rules. Excel adapters map reviewed column names to canonical data paths. Unknown mappings fail closed.

## Source and compiled measurements

Measured source SHA-256: `408c412df0858c913d3d0e753ce7c80e8e8d9444c80cd55fb1247d9a54fad8ea`.

| Measurement | Result |
| --- | ---: |
| Source bytes | 451,013,258 |
| Compiled bytes including seek indexes and manifest | 76,824,999 |
| Reduction | 82.97% |
| Product types | 6,967 |
| Field/path occurrences (including conditional property declarations) | 555,627 |
| Assertion occurrences (`ruleCount`, including type assertions) | 1,987,765 |
| Unique shared container nodes | 106,841 |
| Independently compared retained scalar values | 8,753,777 |

These are occurrence counts across the original schema, not 555,627 globally unique business field names. `product-types.json` binds every category name to its canonical source pointer; graph nodes deduplicate repeated field definitions, required lists, enum lists, array schemas and conditional rules. JSON object keys are sorted; array order is retained. A graph reference is an internal typed value, never confused with a source `$ref`.

The complete catalog remains about 73.27 MiB on disk because it covers all 6,967 categories and retains Walmart metadata. It is not one runtime JSON object. Hash-prefix shard files have byte-offset indexes; runtime verifies shard/index hashes, then seeks to individual node payloads. It caches at most 20,000 nodes per graph and two selected validators. Node expansion is capped at 100,000 containers/scalars; individual nodes at 2 MiB, shards at 4 MiB. The giant source is never read during requests.

The first compiler prototype used too much memory and was replaced before completion. Final measured compilation took approximately 12 seconds with a 384 MiB V8 heap limit and about 427 MiB peak RSS. Independent verification took 10.4 seconds and approximately 451 MiB peak RSS with a 768 MiB heap limit. Inspection took 6.2 seconds and approximately 161 MiB peak RSS. RSS includes Node/native memory beyond the V8 heap. The official-schema golden execution took 0.74 seconds and approximately 234 MiB peak RSS, including workbook parsing, repair, revalidation and structural checks. These are local measurements, not production performance guarantees.

## Commands and reproducibility

Run from the repository root with Node 22+ (Node 24 recommended):

```sh
npm ci
npm run walmart:schema:inspect -- --input src/5.0.20260703-18_22_27-api_MP_ITEM_0_0_en.json
npm run walmart:schema:compile -- --input src/5.0.20260703-18_22_27-api_MP_ITEM_0_0_en.json --output /tmp/schema-27-build
npm run walmart:schema:verify -- --input src/5.0.20260703-18_22_27-api_MP_ITEM_0_0_en.json --compiled /tmp/schema-27-build
npm run walmart:golden
npm test
npm run typecheck
npm run lint
npm run test:e2e
npm run build
```

The versioned compilation already exists at `data/walmart/compiled/5.0.20260703-18_22_27-api`. Compilation refuses to overwrite an existing directory. It publishes a completed staging directory via rename. Generate another directory and compare using `diff -qr <first> <second>` before activating a new version. Compiler version `1.0.0`, graph format and raw-source SHA-256 are in the manifest. `compiledAt` is emitted in the CLI build report, outside deterministic artifacts; redirect stdout to retain that execution record. Same input/compiler/options produce byte-identical manifests, shards, indexes and product-type associations. Do not edit generated artifacts by hand.

Inspection reports top-level keys, version, keyword occurrences, small scalar samples, paths to assertions and all product types. It makes no whole-file `JSON.parse` call. Packed scalar values are capped at 2 MiB, nesting at 128, and ambiguous duplicate keys/unsafe integer precision are rejected. The compiler caps its normalized payload index at 128 MiB and 300,000 nodes. If a future schema exceeds these limits, it must be explicitly adapted; normal requests never fall back to reading the source.

## Preservation verification and omissions

`verify` does not call the compiler or reuse its interning/normalization transformation. It follows original streaming tokens against persisted graph paths and compares every retained scalar, container type, key count and array length. It checks the raw-source hash, category associations, field/rule counts, omission counts, node hashes and shard hashes. Local `$ref` targets must exist; unsupported external/anchor references fail verification. Tests modify semantic values while updating graph checksums to prove verification detects more than corrupted checksums.

| Source feature | Source → compiled occurrences |
| --- | ---: |
| Required arrays | 159,560 → 159,560 |
| Enums | 205,116 → 205,116 |
| Minimum / maximum | 78,512 / 78,512 → identical |
| Multiple-of | 43,898 → 43,898 |
| Min/max string length | 206,998 / 206,998 → identical |
| Min array items | 122,422 → 122,422 |
| Contains | 2,213 → 2,213 |
| All-of | 7,774 → 7,774 |
| If / then | 47,337 / 47,337 → identical |
| Any-of / one-of / not | 124 / 1 / 128 → identical |
| Formats | 29,264 → 29,264 |
| Internal references, patterns, explicit dependencies | Absent in this source; exercised with test schemas |

Only 620,332 schema `description` annotations and 321,798 schema `examples` annotations are discarded. The manifest records counts and reasons. Their paths are auditable by rerunning inspection/source traversal. Keys with those names inside instance-valued `enum`/`const` data or field-name maps are retained. Descriptive prose is not converted into executable rules or used to invent repairs. Titles, units encoded in fields/enums, `comments`, unknown metadata, source `$schema`, assertions and conditional structures remain available in the compiled graph. `comments` is treated as annotation metadata by the runtime. Unknown executable vocabulary, unsupported formats or ambiguous reference scope fails validator construction rather than silently passing.

## Workbook mappings and actual runtime use

`SCHEMA_PATH` now refers to a reviewed mapping of at most 1 MiB. It cannot be the official source JSON. Non-synthetic mappings without a compiled binding are rejected. Existing `SYNTHETIC-1` rules remain available exclusively for development/backwards-compatible synthetic fixture checks; a mapping with `compiled` always selects the official validation path, never those mock field rules.

A mapping evolves the existing `MarketplaceSchema`; it declares the existing sheet/header/marker plus:

```json
{
  "origin": "SYNTHETIC",
  "compiled": {
    "directory": "data/walmart/compiled/5.0.20260703-18_22_27-api",
    "sourceSha256": "408c412df0858c913d3d0e753ce7c80e8e8d9444c80cd55fb1247d9a54fad8ea",
    "productType": "Skateboard Risers",
    "feedHeader": {"businessUnit": "WALMART_US", "locale": "en", "version": "5.0.20260703-18_22_27-api"}
  },
  "fields": [{
    "column": "condition",
    "canonicalPath": "/Visible/Skateboard Risers/condition",
    "schemaPath": "#/properties/MPItem/items/properties/Visible/properties/Skateboard Risers/properties/condition",
    "encoding": "text"
  }]
}
```

This fragment is illustrative, not an official Excel mapping. See the complete, explicitly synthetic mapping at `tests/fixtures/walmart/synthetic/schema-27.mapping.json`. To exercise it locally:

```sh
SCHEMA_PATH=tests/fixtures/walmart/synthetic/schema-27.mapping.json npm run dev
```

Upload its sibling `schema-27.xlsx`. It contains invented data and a synthetic layout. The HTTP integration test uses this exact path through analyze → official validation → safe repair → download → official revalidation. Its only repair is `condition: " new " → "New"`. No current real workbook support is implied.

The runtime verifies version/hash binding, detects the exact declared marker/header layout, checks column mappings, reconstructs all items, and applies draft-07 validation to the complete feed using Ajv with formats. Coercion, defaults and property removal are disabled. Unmapped required fields produce findings. An empty cell is absent, not an invented value; whitespace is retained. `text` preserves strings, `number` and `boolean` use explicit unambiguous conversions, and this adapter requires JSON cells for arrays/objects. Numbers exceeding 15 significant digits or safe integer precision require review. Real Walmart repeated-column/array layouts need a separately reviewed mapping extension, not guessed delimiter splitting. Formulas are preserved and marked `UNSUPPORTED`; FeedFix does not calculate them.

Category specialization keeps the full feed and item envelope. It narrows the source `Visible.oneOf` only after proving every branch is a simple, unique required-category selector matching the catalog. The adapter constructs exactly one category per item. Nested `$id` scope and references into specialized feed contexts are refused. Local references to unchanged definitions are supported. The full item array is validated, including min/max/unique/contains constraints. This prevents the singleton-row validation error identified during review.

Official automatic repairs are deliberately conservative: only a unique enum casing/whitespace match is eligible, only on a structurally safe text cell, and only if the entire reconstructed feed validates after that candidate. Other errors or uncertainty prevent automatic change. No arbitrary enum choice, invented required value, truncation, inferred unit conversion or guessed identity correction occurs. Legacy synthetic-only whitespace/GTIN checks are not silently applied as official assertions.

## Workbook integrity and confidence

The existing ZIP/XML writer is retained. Every repair now compares before/after archive member names/order and all unmodified member bytes. For changed worksheets, only explicitly approved cell value payloads and their text representation may differ; cell attributes/styles and every other worksheet byte must remain identical. Formula parts, hidden-sheet state, sheet ordering, merged cells, validation lists, defined names, relationships, document properties and unknown XML are protected by these comparisons. Tests also independently reopen repaired files with ExcelJS and inject structural corruption to prove rejection.

ZIP compression representation/CRC and modified ZIP-entry timestamps can be regenerated for edited entries; uncompressed contents are the structural comparison boundary. An empty repair plan returns the original buffer exactly. Golden runs require `repair(repair(file))` to be byte-identical to `repair(file)`; no metadata exception is needed on the second repair. Existing security refusals for macros, external links, embedded objects, signatures, unsafe formulas and decompression limits remain in force.

Issues retain the compatible legacy resolution values and add `level: ERROR | WARNING | INFO`, `fixability: SAFE_AUTO_FIX | REVIEW_REQUIRED | UNSUPPORTED`, canonical instance paths and schema paths. Current checks emit errors/warnings; INFO is available for informational diagnostics. Reports use post-repair findings; server records pin the mapping used for later downloads. The API returns provenance/scope and findings, not schemas or workbook content.

## Golden fixtures and support gates

All seven available XLSX fixtures have explicit `.golden.json` metadata: origin, schema version, SHA-256, expected initial/remaining findings, exact repairs and allowed cell changes. Six are the existing synthetic parser/rule fixtures; one exercises the real compiled `-27` rules. The legacy/current directories contain no fabricated evidence. `npm run walmart:fixtures` regenerates only the explicitly synthetic official-rule fixture; it cannot create real provenance.

Run one fixture and save a new report with:

```sh
npm run walmart:golden -- --fixture tests/fixtures/walmart/synthetic/schema-27.golden.json --output /tmp/schema-27-golden.json
```

The harness detects the declared template, compares findings, repairs, revalidates, checks structural integrity and verifies idempotency. A successful run retains the input origin. `WALMART_LEGACY_REAL` never becomes `WALMART_CURRENT_SUPPORTED` because tests passed.

Current Walmart compatibility claims require `synthetic: false`, explicit `WALMART_CURRENT_SUPPORTED` mapping origin, compiled binding, and a trusted local golden evidence report with matching source/version/mapping hashes, fixture hash, PASS and named human review. Configure that report using `goldenEvidencePath`. This remains a local operator trust boundary, not Walmart certification. The historical `paidSupportEligible` evidence field is retained for compatibility and supported-template SEO, but no longer gates voluntary payments. Per the September 5, 2026 product decision, optional support is available after a generated correction regardless of provenance; the app and Stripe Checkout disclose that payment does not guarantee Walmart acceptance or certify template compatibility. Template detection, schema validation and free downloads retain their existing rules. Local mock payments remain development-only.

## Deployment

The source stays at its existing local path; it was not moved or deleted. Git ignores source artifacts and Windows Zone.Identifier streams. Docker excludes the source directory and MP_ITEM source filename pattern; Next output tracing explicitly excludes them too. The runtime Docker stage copies only `data/walmart/compiled`, never the source or compiler tooling. Mount a reviewed small mapping/evidence outside the temporary upload directory and point `SCHEMA_PATH` to it. Its compiled directory should be `/app/data/walmart/compiled/<version>` inside the container. Rebuild after changing compiled artifacts; mappings should reference immutable version directories. No deployment was performed for this integration.

## What still prevents current Walmart compatibility claims

No real legacy or current workbook was supplied. The API schema cannot prove Excel sheet/column identity, export conventions, hidden metadata compatibility or Walmart ingestion acceptance. A real current workbook, its reviewed version/category mapping, golden expectations and structural roundtrip are still required. The compiler verification establishes source preservation; the synthetic golden establishes execution of official rules. Neither establishes Walmart workbook acceptance, official endorsement or full coverage across 6,967 Excel template layouts. Unsupported reference scopes, repeated-column encodings, multiple item-sheet layouts and prose-only business rules require explicit future work with evidence.

References used for implementation: local Next.js `node_modules/next/dist/docs/` guides for scripts, backend-for-frontend and output tracing; [stream-json token parser](https://github.com/uhop/stream-json/wiki/Parser); [Ajv JSON Schema support](https://ajv.js.org/json-schema.html). Walmart field/rule facts above come from the local source artifact, not guessed web examples.


## Final executed verification

- `npm test`: 91 tests passed in 10 files. Includes the original 48 tests, compiled-rule matrix, semantic compiler corruption, numeric precision/underflow, full-feed array constraints, reference/cache safety, golden provenance and HTTP analyze/download gates. A focused Stripe rerun also passed after adding evidence-revocation coverage.
- `npm run walmart:golden`: all seven fixtures passed, all classified SYNTHETIC; one uses the real official -27 rules.
- `npm run walmart:schema:verify`: PASS against the actual 451,013,258-byte source, comparing 8,753,777 retained scalars.
- Independent compilations: `diff -qr` produced no differences.
- TypeScript, ESLint, production build and `git diff --check`: passed.
- Playwright: six desktop/mobile tests passed. Final run had no captured browser error/console-error messages. Analytics is disabled in the test-server environment to avoid external tracking traffic; the initial run exposed pre-existing GA4 CSP collection warnings, outside this schema integration.
- Source file is ignored by Git and absent from tracked files, standalone output and browser assets. Docker source exclusions and compiled-only runtime copy are configured; a Docker image was not built or deployed in this session.

Machine-readable results: [walmart-validation-evidence.json](walmart-validation-evidence.json). These are technical PASS results for the stated checks. **Current real Walmart workbook compatibility remains unverified**, so no overall Walmart-compatibility PASS or real-payment eligibility is claimed. Candidate exploration is capped at 20 attempts and a 200,000 mapped-cell evaluation budget; exhausted searches leave findings for review.


## New-template product outcome (September 2026)
The engine remains fail-closed. Safe unknown uploads now pass through read-only structural identification after exact mapping checks. `NEW_WALMART_TEMPLATE` means multiple Walmart layout signals were found, **not** current compatibility, authenticated origin or successful validation. No fixes, corrected output, analysis capability or checkout exist for that result. `UNKNOWN_SPREADSHEET` avoids a false Walmart claim. Unsafe/corrupt workbooks remain rejected before study storage.

The local legacy workbook informed conservative marker/metadata recognition (including its 30-character hidden-sheet convention); it was not promoted, rewritten or copied into new permanent fixtures. Generated regression candidates are explicitly `SYNTHETIC`. The compiled schema, compiler, source artifact and approved mappings are unchanged; supported uploads still reach the existing compiled validator and surgical patch/integrity path.

Private sharing reuses ContributionStore with opt-in and 59-minute expiry. A separately consented, private 30-day notification callback may retain an email and header-only layout key, never workbook rows. No automatic email or automatic support promotion occurs. The [study operations guide](workbook-study-copies.md#reviewing-a-new-layout) explains the mandatory human review, separately authorized real evidence, explicit mapping and golden approval path. See [architecture](../ARCHITECTURE.md#explicit-upload-outcomes) for the API contract.

### Verification of the new-template flow
Executed against this workspace on 2026-09-05:

| Command | Actual result |
| --- | --- |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 123 tests, 13 files |
| `npm run build` | Exit 0; production Next build |
| `npm run test:e2e` | Exit 0; 16 desktop/mobile scenarios |
| `npm run walmart:golden` | Exit 0; 7 SYNTHETIC goldens, including compiled schema-27 validation and package integrity |
| `npm run walmart:schema:verify -- --input src/5.0.20260703-18_22_27-api_MP_ITEM_0_0_en.json --compiled data/walmart/compiled/5.0.20260703-18_22_27-api` | Exit 0; PASS, 8,753,777 scalar comparisons; source SHA-256 `408c412df0858c913d3d0e753ce7c80e8e8d9444c80cd55fb1247d9a54fad8ea` |

The first browser run exposed a test selector that counted Next's global route-announcement alert. Scoping the assertion to FeedFix's `main` preserves the no-product-error assertion; the complete suite then passed. Initial identification tests also caught the legacy hidden-sheet truncation convention; the identifier now matches the observed 30-character name and requires actual hidden visibility. Additional tests cover config failures (not falsely labeled as new/unsafe), malicious reports on unsupported uploads, private directory boundaries, callback redaction, rate limits, independent expiry/deletion and no-consent behavior. Browser requests use the real backend and generated SYNTHETIC XLSX bytes; there are no new mocked analyze/share/notification responses.

Read-only inspection of local `src/walmart.xlsx` returned a structural candidate. This is not proof that the file is authentic, current or accepted by Walmart. No real-current golden was added. The compiler/source artifacts and approved mappings were not modified.

### Implementation file inventory
- Engine: `src/engine/identify-workbook.ts`, `model.ts`, `workbook.ts`, `validate.ts` — read-only identification/visibility, typed invalid-file and mapping-mismatch boundaries; existing validation and patch behavior reused.
- API/storage: `src/shared/upload-result.ts`, `src/server/service.ts`, `http.ts`, `contributions.ts`, `workbook-study.ts`, `template-notifications.ts`, `store.ts`, `analytics.ts` — explicit outcomes, existing study receipts, private callback adapter/sweeper and sanitized events.
- Product UI: `src/app/new-template-result.tsx`, `utility.tsx`, `globals.css`, `supported-templates/page.tsx` — result/share/optional callback, private text masking, honest secondary compatibility copy.
- Configuration: `.env.example`, `.gitignore`, `.dockerignore`, `Dockerfile`, `docker/entrypoint.sh`, `playwright.config.ts` — private notification directory and test isolation; no new infrastructure dependency.
- Verification: `tests/helpers/new-template.ts`, `tests/new-template.test.ts`, `tests/contributions.test.ts`, `tests/stripe.test.ts`, `tests/walmart-golden.test.ts`, `e2e/new-template.spec.ts`, `e2e/seo.spec.ts` — new contract tests and existing callers adapted to discriminate the result.
- Documentation: `PRODUCT.md`, `ARCHITECTURE.md`, `README.md`, this report and `docs/workbook-study-copies.md`.

Remaining limits: conservative recognition intentionally misses other Walmart conventions; fingerprints cannot establish support. Callback addresses are syntax-validated but ownership is not verified, and no email is sent. Host outages and backups require deployment-level lifecycle controls; application TTLs alone cannot erase an offline disk. No production deployment, real email delivery or real-current Walmart acceptance test was performed for this task. One-hour sharing does not authorize retaining a permanent real golden fixture.

Repository note: a concurrent commit `20abde4` incorporated implementation files during this work. No commit or push command was executed by this task. The final working-tree diff therefore shows only changes remaining after that commit, not the entire implementation inventory above.
