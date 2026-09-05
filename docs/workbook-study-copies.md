# One-hour private workbook study copies

Users can opt in, with an unchecked checkbox, to a private copy of the original workbook for structure review. The recorded consent is `workbook-study-1h-v1`. Sharing is independent of analysis/payment and is not required to use FeedFix. No AI training, publication, permanent fixture ingestion or automatic compatibility promotion is performed.

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
```

The list contains capture IDs, hashes, sizes, origin and expiry only. Inspect reports worksheet names and counts of cells/formulas without dumping cell values. These are local administrative commands, not API routes. While a copy exists, an authorized operator can study `CORPUS_STORE_DIR/<id>/original.xlsx` on the private host. Do not export it into permanent fixtures, logs or reports; all copies and workbook-specific study material must respect the one-hour limit.

The Docker runtime contains an equivalent bundled CLI:

```sh
node study-uploads.cjs list
node study-uploads.cjs inspect <id>
node study-uploads.cjs cleanup
```

Checks cover no-consent behavior, exact-byte preservation, permissions, consent metadata, UNKNOWN provenance, authorized deletion, capacity, expiration, corrupt receipt cleanup, private-path restrictions and receipt delivery on unsupported-template errors. Browser tests exercise opt-in and early deletion on desktop/mobile. This change prepares the code and container configuration; it does not deploy the service.

Verification executed: 98 Vitest tests passed across 11 files, eight Playwright tests passed across desktop/mobile, TypeScript/ESLint/production build passed, and the bundled operator CLI ran successfully. The final browser run reported no captured page/console errors. `git diff --check` passed. No deployment was performed.
