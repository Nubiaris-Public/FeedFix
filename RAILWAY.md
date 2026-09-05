# Deploy FeedFix to Railway

One Docker service, one 1 GB volume, one always-on replica. No database. Downloads are free; Stripe support is optional. Start with about 1 GB RAM and measure real workbook load before increasing limits.

## Create the environment

1. Push this repository to GitHub. Create a dedicated Railway project/environment for FeedFix.
2. Install Railway CLI **5.42.1 or newer**, run `railway login`, then `railway link` to select that environment. Run `npm ci` in this repository.
3. Run `railway config plan`, review the proposed `feedfix` service and `feedfix-data` volume, then `railway config apply`. The configuration is [.railway/railway.ts](.railway/railway.ts). Use a dedicated environment: omitted resources in this project-level definition can be deleted. For an existing populated environment, import its configuration first and merge intentionally.
4. The `feedfix` service explicitly uses GitHub repository `Nubiaris-Public/FeedFix`, branch `master`. Grant Railway access to that repository. Update `source` in the IaC file if you deploy a fork or another branch.
5. The definition declares custom domain `feedfix.app` and `APP_URL=https://feedfix.app`. In Railway networking, obtain the required DNS records for that domain and configure them with its DNS provider. Wait for domain/certificate verification, then open `https://feedfix.app`. Redeploy after changing variables.

Railway discovers the root Dockerfile. Keep Build/Start command overrides empty: the image builds Next.js and starts `node server.js` through its entrypoint. Do not use `npm start` for this standalone image. Railway supplies `PORT`; the server binds to `0.0.0.0`.

If the Railway canvas shows a Bun Function, that is not the configured FeedFix runtime. Create/connect a GitHub repository service for this repository using its root Dockerfile, then attach the `/data` volume and settings below. Do not paste `.railway/railway.ts` into a Function editor: it is infrastructure configuration evaluated by `railway config plan/apply`. Review the plan before applying to an environment containing the existing Function; do not delete resources or volumes until the replacement is verified.

The IaC SDK is a development dependency, not a second runtime service. Current Railway uses TypeScript IaC; legacy `railway.json`/`railway.toml` is deprecated. See [official IaC workflow](https://docs.railway.com/infrastructure-as-code) and [CLI installation](https://docs.railway.com/cli).

## Variables and storage

The IaC file sets these non-secret defaults:

| Variable / setting | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PAYMENT_MODE` | `stripe` |
| `STRIPE_PRICE_AMOUNT` | `499` USD cents, optional support |
| `TEMP_STORE_DIR` | `/data/feedfix` |
| `USAGE_LOG_PATH` | `/data/metrics/usage.json` |
| `FILE_TTL_MINUTES` | `59` |
| `MAX_UPLOAD_MB` | `25` |
| `ANALYTICS_ENABLED` | `true` |
| Volume mount | `/data`, 1024 MB, `us-west2` |
| Replicas | 1, same region as volume |
| Healthcheck | `/api/health`, timeout 60 seconds |
| Serverless / sleep | Disabled |

The production definition sets `APP_URL=https://feedfix.app` and `SEO_INDEXABLE=true`. The remaining site-specific values use `preserve()` and can be set in Railway Variables:

- `APP_URL`: your public HTTPS origin. Required for browser requests and Checkout redirects.
- `SEO_INDEXABLE=true`: enable Google indexing on the final production domain only. Defaults to false when absent. Keep previews false. See [SEO.md](SEO.md).
- `GOOGLE_SITE_VERIFICATION`: optional Search Console HTML verification content value; managed in Railway Variables.
- `ALLOW_SYNTHETIC_FIXTURES=true`: for a preview using the fictional fixtures. These cannot accept real payments. Set false for real traffic.
- `SCHEMA_PATH`: absolute path to a reviewed official schema JSON for real files. There is no official Walmart schema bundled. Include the reviewed schema in the Docker image with an explicit `COPY` and point here; keep it outside `/data/feedfix`.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`: optional until enabling support payments. Missing keys do not block free analysis/downloads.
- `TRUSTED_IP_HEADER`: leave unset until the deployed proxy's overwrite behavior is verified. Without a trusted header, the app conservatively shares one rate-limit bucket across requests.

Do not enable volume backups/snapshots: the volume contains temporary spreadsheets. Aggregate counts survive restarts and redeploys, but deleting the volume deletes the counts. The entrypoint initializes directory ownership on the mounted volume and runs Node as the unprivileged `node` user. It rejects Railway startup if `/data` is not mounted. Do not override its user or entrypoint.

The healthcheck verifies directory access and starts expiry cleanup. It does not promise Walmart schema compatibility or Stripe readiness. Keep one replica and deploy overlap at zero: the local state/usage lock is single-process. A volume-backed redeploy may have brief downtime. Expired files are deleted while running; an offline service cannot physically delete files until restarted. Do not suspend it with pending uploads. See [Railway volumes](https://docs.railway.com/volumes).

## Optional Stripe support

Set Stripe test keys first. Register `https://YOUR_DOMAIN/api/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`; set the resulting signing secret in Railway. Use Stripe Checkout test mode with a reviewed real schema before enabling live keys. Production deliberately disables mock-payment endpoints. Support never unlocks or blocks downloads.

## Verify and inspect counts

1. Open `/api/health`: expect HTTP 200 and `{"status":"ok"}`.
2. With synthetic fixtures enabled, upload `tests/fixtures/walmart/multiple-errors.xlsx`, download the corrected XLSX and change report. Confirm the reported changes. Refresh/repeat the download: the same analysis counts once.
3. Connect to the running container with `railway ssh --service feedfix` and run:

   ```sh
   node /app/stats.cjs
   ```

   Local equivalent: `npm run stats`. `railway run` executes locally and does **not** read the deployed volume. Totals distinguish `real` from `synthetic`; they contain no spreadsheet cells. A count means a corrected XLSX was generated for download, not that Walmart accepted it. Acceptance feedback is separately user-reported.
4. Redeploy and recheck the totals. Check the original link expires after the configured TTL. Test mobile and desktop upload on the public origin.

For rollback, redeploy the previous working image/commit while retaining the same volume and environment variables. Do not restore temporary spreadsheets from backups. If a future release changes the usage format, maintain backward compatibility before deployment.

## Local container check

```sh
docker build -t feedfix .
docker run --rm -p 3000:3000 -v feedfix-data:/data \
  -e APP_URL=http://localhost:3000 \
  -e ALLOW_SYNTHETIC_FIXTURES=true feedfix
```

The project is prepared for deployment; creating a Railway environment, public domain and live Stripe configuration requires your accounts. No provider deployment or real charge is implied by local tests.

## One-hour workbook study copies

The Docker image defaults `CORPUS_STORE_DIR=/data/study` and initializes that private directory on the existing volume. User opt-in is required. Copies expire at 59 minutes and are swept every 30 seconds; keep the service running and exclude this directory from backups. Administer unexpired copies inside the container with `node study-uploads.cjs list` and `node study-uploads.cjs inspect <id>`. No public browsing endpoint exists. See [the study-copy guide](docs/workbook-study-copies.md) for limits and outage semantics.
