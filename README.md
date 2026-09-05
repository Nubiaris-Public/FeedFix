# FeedFix V0

A compact, no-account utility: XLSX → free diagnosis → free corrected XLSX + auditable JSON changes → optional Stripe support.

**Current compatibility: synthetic fixtures only.** No official Walmart template was present in this repository. The engine and funnel are implemented; real seller compatibility and the first voluntary support payment remain unvalidated. Synthetic files cannot trigger a real charge.

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

1. Obtain and validate an official template/schema pair as described in [ARCHITECTURE.md](ARCHITECTURE.md). Create a reviewed schema JSON and set SCHEMA_PATH to its absolute path. `schema.synthetic.json` documents the adapter shape; its column names and constraints are fictitious. Changing its synthetic flag does not make it official.
2. Set PAYMENT_MODE=stripe, STRIPE_SECRET_KEY (first `sk_test_…`), STRIPE_WEBHOOK_SECRET, APP_URL and STRIPE_PRICE_AMOUNT (integer USD cents, default 499).
3. Forward Stripe webhooks for local testing:
   ```bash
   stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to localhost:3000/api/webhook
   ```
   Put the signing secret printed by Stripe CLI in `.env`, restart the app, and pay through the **actual Checkout session created by this app** using Stripe's test card. An unrelated `stripe trigger` event cannot mark support as paid because the session, analysis and amount must match.
4. Deploy the Dockerfile to one always-on Railway service with a private volume at `/data`, or one Render service with an equivalent disk. Mount the reviewed schema outside the temporary record directory; set SCHEMA_PATH accordingly. Set HTTPS APP_URL. Configure the public `/api/webhook` endpoint in Stripe, then switch to live keys only after the official-template roundtrip succeeds.
5. One instance only. No autoscaling, no ephemeral serverless storage, no volume backups containing files. Do not log request Authorization headers or bodies. Set TRUSTED_IP_HEADER only if the edge overwrites it and direct origin access is blocked; otherwise requests share a conservative rate-limit bucket. Configure edge body limits/timeouts and disable access logging of analysis URLs if possible.

To preview a production build with synthetic files, set ALLOW_SYNTHETIC_FIXTURES=true and run `npm run build && npm start`. Real checkout stays blocked for synthetic files, and mock payments stay disabled because NODE_ENV is production.

## Retention and payment expiry

Originals, issues, plans and payment state are private temporary records. Default expiry is 59 minutes, with cleanup every 30 seconds while the process runs. Records survive a restart on the same volume. Cleanup also runs on access/start of API use. A stopped host cannot run deletion: production must have a volume lifecycle guarantee or purge expired records before serving traffic. No snapshots/backups of this directory.

Checkout may start during the first 15 minutes and expires 45 minutes after analysis creation. Downloads expire with the analysis, never later than one hour. Late confirmed payments with expired records are refunded idempotently; webhook failures return non-2xx for Stripe retries. Keep the original browser tab: its separate bearer token is stored in sessionStorage, never Stripe metadata or URLs. Closing that tab loses access. Download both artifacts before expiry; payment is never required.

## Environment

See [.env.example](.env.example). STRIPE_PRICE_AMOUNT is cents, not a Stripe Price ID. MAX_UPLOAD_MB is capped at 25; actual ZIP expansion, sheet and cell limits may reject smaller complex files. FILE_TTL_MINUTES accepts 45–59. TEMP_STORE_DIR needs private, persistent storage. ANALYTICS_ENABLED writes only allowlisted aggregate events to stdout; replace the Analytics adapter for another sink. No filenames, identifiers or cell contents are logged.

## Limits and launch evidence

No live Stripe charge, official Walmart import, provider deployment or field performance measurement has been performed. Configure actual credentials locally; never put them in Git. The `.git` directory supplied by the environment is read-only and was not a valid repository, so no commits or remote were created.

`npm audit` identified a moderate advisory in ExcelJS's dev-only uuid dependency. ExcelJS only calls uuid v4 without a buffer; the reported v3/v5/v6 buffer API is not reached. ExcelJS is absent from the production writer. Do not downgrade workbook tooling blindly to silence an advisory. See architecture for the preservation tradeoff.

[IDEA.md](IDEA.md) defines the business hypothesis. [PRODUCT.md](PRODUCT.md) freezes scope. [ARCHITECTURE.md](ARCHITECTURE.md) records technical decisions, sources, diagrams and the official files required before launch.


## How many files have we corrected?

```bash
npm run stats
```

The command loads `.env` using Next’s environment loader. USAGE_LOG_PATH defaults to `.feedfix-metrics/usage.json`; production Docker uses `/data/metrics/usage.json`. Keep it on the private persistent volume and separate from TEMP_STORE_DIR. The output contains `totals.real.corrected_files`, `totals.synthetic.corrected_files`, applied `corrections`, daily UTC breakdowns, and `YES` / `NO` / `NOT_YET` user-reported Walmart outcomes. An empty log returns zeros. Stats are private: there is no public endpoint or dashboard.

We count the first successful corrected XLSX generation requested for each analysis, with at least one fix. Analysis/preflight alone, JSON-report downloads and repeated XLSX downloads do not increase the count. Uploading the same input again is a new analysis and can count again. This does not measure unique users, successful network delivery or verified Walmart acceptance. Synthetic traffic never increases the real count.

Only daily aggregates survive permanently. Temporary hashed deduplication receipts expire with the analysis and are swept every 30 seconds while running; no content, filenames, product identifiers, IPs or bearer tokens are retained in metrics. Stopped hosts still require the lifecycle precautions described above. If metrics storage fails, downloads continue and a structured `correction_log_write_failed` warning is emitted. A later request retries the count; without a retry an undercount is possible. Do not treat absent log data as confirmed zero usage after a storage error.
