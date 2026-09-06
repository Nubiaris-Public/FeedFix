# FeedFix V0

A compact, no-account utility: paste a Walmart error → free explanation → optional XLSX inspection → free corrected XLSX + auditable JSON changes → optional Stripe support.

**Current workbook compatibility: synthetic fixtures only.** The official Walmart `5.0.20260703-18_22_27-api` schema is now compiled and used by the runtime through explicit workbook mappings. No real current Walmart workbook was supplied, so current workbook compatibility and real seller acceptance remain unvalidated. Optional support after a free corrected download is independent of compatibility evidence; it does not certify Walmart acceptance. See [the integration report](docs/walmart-schema-integration.md) for compiler commands, verification, golden fixtures and measured limits.

## Run locally

Node 24 recommended (Node 22+ supported).

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. The example environment enables local mock payment. Upload `tests/fixtures/walmart/multiple-errors.xlsx`, optionally attach `processing-report.csv`, and click Analyze. Without the report, expect **2 items, 5 issues, 2 safe fixes**. Download both artifacts for free. After downloading the XLSX, optionally answer the Walmart acceptance question and simulate a support payment. No keys or real money are needed for this local path.

The mock uses a signed synthetic Stripe webhook internally. Its endpoint is unavailable in production, even if PAYMENT_MODE=mock is set. Never expose a development server publicly.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Playwright starts its own local dev server on port 3100 with mock payments; stop any existing process on that port first. `npm run fixtures` regenerates all fictitious workbooks. The JSON report lists cell addresses, original/new values, issue IDs and rule IDs. Unit tests compare untouched ZIP entries byte-for-byte and independently read the output using ExcelJS.

Webpack is explicitly selected because Turbopack's CSS worker required a socket unavailable in the original restricted development environment. Type checking remains enabled. Next may add its default TypeScript options during build.

## Production and real Stripe test mode

See [the Stripe payment plan and setup guide](docs/stripe-setup.md) for account selection, exact variables, webhook events and activation checks.

1. Obtain and validate an official template/schema pair as described in [ARCHITECTURE.md](ARCHITECTURE.md). Create a reviewed schema JSON and set SCHEMA_PATH to its absolute path. `schema.synthetic.json` documents the adapter shape; its column names and constraints are fictitious. Changing its synthetic flag does not make it official. Real mappings must bind a verified compiled schema and explicit current golden evidence before claiming current Walmart compatibility. Optional support does not require that claim.
2. Set PAYMENT_MODE=stripe, STRIPE_SECRET_KEY (prefer a restricted sandbox key, `rk_test_…`), STRIPE_WEBHOOK_SECRET, APP_URL and STRIPE_PRICE_AMOUNT (integer USD cents, default 499).
3. Forward Stripe webhooks for local testing:
   ```bash
   stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to localhost:3000/api/webhook
   ```
   Put the signing secret printed by Stripe CLI in `.env`, restart the app, and pay through the **actual Checkout session created by this app** using Stripe's test card. An unrelated `stripe trigger` event cannot mark support as paid because the session, analysis and amount must match.
4. Deploy the Dockerfile to one always-on Railway service with a private volume at `/data`, or one Render service with an equivalent disk. Mount the reviewed schema outside the temporary record directory; set SCHEMA_PATH accordingly. Set HTTPS APP_URL. Configure the public `/api/webhook` endpoint in Stripe, then switch to live keys only after the official-template roundtrip succeeds.
5. One instance only. No autoscaling, no ephemeral serverless storage, no volume backups containing files. Do not log request Authorization headers or bodies. Set TRUSTED_IP_HEADER only if the edge overwrites it and direct origin access is blocked; otherwise requests share a conservative rate-limit bucket. Configure edge body limits/timeouts and disable access logging of analysis URLs if possible.

To preview a production build with synthetic files, set ALLOW_SYNTHETIC_FIXTURES=true and run `npm run build && npm start`. Optional real support is available after generating a corrected download when Stripe is configured; synthetic limitations remain visible. Mock payments stay disabled because NODE_ENV is production.

## Retention and payment expiry

Originals, issues, plans and payment state are private temporary records. Default expiry is 59 minutes, with cleanup every 30 seconds while the process runs. Records survive a restart on the same volume. Cleanup also runs on access/start of API use. A stopped host cannot run deletion: production must have a volume lifecycle guarantee or purge expired records before serving traffic. No snapshots/backups of this directory.

Checkout may start during the first 15 minutes and expires 45 minutes after analysis creation. Downloads expire with the analysis, never later than one hour. Late confirmed payments with expired records are refunded idempotently; webhook failures return non-2xx for Stripe retries. Keep the original browser tab: its separate bearer token is stored in sessionStorage, never Stripe metadata or URLs. Closing that tab loses access. Download both artifacts before expiry; payment is never required.

## Environment

See [.env.example](.env.example). STRIPE_PRICE_AMOUNT is cents, not a Stripe Price ID. MAX_UPLOAD_MB is capped at 25; actual ZIP expansion, sheet and cell limits may reject smaller complex files. FILE_TTL_MINUTES accepts 45–59. TEMP_STORE_DIR needs private, persistent storage. CONSOLE_ACTIVITY_ENABLED defaults to true and logs landing_view/upload_completed to stdout. ANALYTICS_ENABLED=true additionally logs other allowlisted funnel events; replace the Analytics adapter for another sink. No filenames, identifiers or cell contents are logged.

Browser GA4 and Clarity injection is disabled for Error Decoder privacy. `GA_MEASUREMENT_ID` and `CLARITY_PROJECT_ID` no longer load scripts. Keep hosting-injected replay/tag scripts disabled too. First-party server metrics remain available; see [analytics policy](docs/analytics.md).

## Limits and launch evidence

No live Stripe charge, official Walmart import, provider deployment or field performance measurement has been performed. Configure actual credentials locally; never put them in Git.

`npm audit` identified a moderate advisory in ExcelJS's dev-only uuid dependency. ExcelJS only calls uuid v4 without a buffer; the reported v3/v5/v6 buffer API is not reached. ExcelJS is absent from the production writer. Do not downgrade workbook tooling blindly to silence an advisory. See architecture for the preservation tradeoff.

[IDEA.md](IDEA.md) defines the business hypothesis. [PRODUCT.md](PRODUCT.md) freezes scope. [ARCHITECTURE.md](ARCHITECTURE.md) records technical decisions, sources, diagrams and the official files required before launch.


## How many files have we corrected?

```bash
npm run stats
```

The command loads `.env` using Next’s environment loader. USAGE_LOG_PATH defaults to `.feedfix-metrics/usage.json`; production Docker uses `/data/metrics/usage.json`. Keep it on the private persistent volume and separate from TEMP_STORE_DIR. The output contains `totals.real.corrected_files`, `totals.synthetic.corrected_files`, applied `corrections`, daily UTC breakdowns, and `YES` / `NO` / `NOT_YET` user-reported Walmart outcomes. An empty log returns zeros. Stats are private: there is no public endpoint or dashboard.

We count the first successful corrected XLSX generation requested for each analysis, with at least one fix. Analysis/preflight alone, JSON-report downloads and repeated XLSX downloads do not increase the count. Uploading the same input again is a new analysis and can count again. This does not measure unique users, successful network delivery or verified Walmart acceptance. Synthetic traffic never increases the real count.

Only daily aggregates survive permanently. Temporary hashed deduplication receipts expire with the analysis and are swept every 30 seconds while running; no content, filenames, product identifiers, IPs or bearer tokens are retained in metrics. Stopped hosts still require the lifecycle precautions described above. If metrics storage fails, downloads continue and a structured `correction_log_write_failed` warning is emitted. A later request retries the count; without a retry an undercount is possible. Do not treat absent log data as confirmed zero usage after a storage error.

Railway deployment: follow [RAILWAY.md](RAILWAY.md) for the service, volume, domain, optional Stripe and deployed statistics.

Google indexing and Search Console: [SEO.md](SEO.md). Indexing is opt-in with `SEO_INDEXABLE=true` on the final HTTPS production domain.

## Optional workbook study copies

An unchecked upload option lets a user share the original workbook privately for up to one hour to help study template structure. New Walmart layout candidates receive a useful identification result and can be shared with consent without creating a corrected file or checkout. Generic spreadsheets are described honestly; unsafe files remain errors. There is no permanent fixture ingestion or AI training. Copies begin as `UNKNOWN`, remain separate from analysis records, and can be deleted early by the uploader. Run `npm run walmart:uploads -- list` to find unexpired copies on the private host. See [the storage, retention and operator guide](docs/workbook-study-copies.md).


## New Walmart template flow
Upload any valid XLSX within the limits; the backend decides compatibility after security inspection. Supported mappings keep the existing analysis/download flow. A structurally corroborated but unmapped Walmart candidate gets “Walmart file detected”, optional “Share securely”, and an optional template-specific “Notify me” after sharing. This is not verified authenticity, version currency or Walmart acceptance.

Callbacks use `NOTIFICATION_STORE_DIR` (local `.feedfix-notifications`, Docker `/data/template-notifications`), separate from `TEMP_STORE_DIR` and `CORPUS_STORE_DIR`, with private permissions and a maximum 30-day lifetime. No email is sent by this implementation. Keep the directory out of backups, public assets and build context; one always-on instance and the existing sweeper are required. Email is opt-in and excluded from analytics/logs. See [the operational privacy policy](docs/workbook-study-copies.md#optional-template-notification-callback).

Regression coverage: `tests/new-template.test.ts` and `e2e/new-template.spec.ts` use explicitly synthetic structural candidates against real HTTP handlers on desktop/mobile. These tests do not establish real Walmart compatibility.


## Console activity logs
Two existing events answer whether the uploader is being visited and whether files are arriving. They are enabled by default, including when `ANALYTICS_ENABLED` is unset or false. Set `CONSOLE_ACTIVITY_ENABLED=false` to disable these two logs; `ANALYTICS_ENABLED=true` independently enables the remaining funnel events. No GA4 configuration is required.

- `landing_view`: the browser opens/mounts the main uploader. Reloads/returns count again; this is not unique visitors or a count of all guide-page traffic. JavaScript blocking, network errors and rate limits can undercount; development Strict Mode can repeat mounts.
- `upload_completed`: a multipart request containing a workbook file has arrived within the overall body limit. Emitted before file validation, so corrupt/rejected files are visible too. It does not mean analysis succeeded. `entryPoint: "analyze"` identifies analysis uploads; `"study_share"` identifies a repeat upload for private sharing. Selecting a file without submitting it is not a received upload.

Each JSON line includes UTC `timestamp`, `level`, `event`, a server-generated per-request `requestId`, fixed `entryPoint` and allowlisted properties (upload size bucket only for uploads). No filename, IP, email, raw URL, token or workbook content is logged. These are submission/open counts, not people or verified Walmart workbooks. Logging is best effort and cannot block the flow.

In Railway, open the service's runtime logs and search `landing_view` or `upload_completed`. The change requires deploying this version; it does not change an already-running container. Standard output is also available through the host's normal container logs.

## Walmart Error Decoder
Start on the landing by pasting a non-sensitive Walmart error. “Explain this error” returns free documented or explicitly uncertain guidance before any upload. UNKNOWN offers optional reviewed/redacted sharing, with explicit consent and a separate 7-day private retention period. “Check my spreadsheet” uses the existing uploader, correction and new-template flows. No login, LLM, Walmart connection or payment.

Set `UNKNOWN_ERROR_STORE_DIR` to private storage (local `.feedfix-errors`, Docker `/data/unknown-errors`), separate from all other stores. Do not back it up or log request bodies. [Catalog, API contract, retention and limitations](docs/error-decoder.md); [analytics allowlist](docs/analytics.md). Run `npm test` for matcher/API/privacy tests and `npm run test:e2e` for desktop/mobile guidance, unknown consent, XSS and existing XLSX regression checks.
