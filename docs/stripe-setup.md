# Stripe payment plan and setup

## Payment model

FeedFix's current product scope offers free diagnosis, corrections and downloads, followed by optional **$4.99 USD one-time support**. There is no subscription or payment gate. The server snapshots `STRIPE_PRICE_AMOUNT=499` into each analysis and creates a Stripe-hosted Checkout Session after the corrected workbook has been generated.

Checkout creates its product and price inline. No pre-created Product, Price ID, Payment Link, publishable key or Billing plan is required. A standalone Payment Link would bypass the analysis/session verification used by this integration.

## Configuration

Set local values in the ignored root `.env`; set production secrets in Railway's FeedFix service variables. Never prefix Stripe secrets with `NEXT_PUBLIC_`. Restart locally or redeploy after changing runtime variables.

| Variable | Local Stripe sandbox | Production |
| --- | --- | --- |
| `APP_URL` | `http://localhost:3000` | `https://feedfix.app` |
| `PAYMENT_MODE` | `stripe` | `stripe` |
| `STRIPE_PRICE_AMOUNT` | `499` | `499` (integer USD cents) |
| `STRIPE_SECRET_KEY` | Restricted sandbox key, `rk_test_…` | Restricted live key, `rk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from `stripe listen` | Signing secret for the production webhook endpoint |
| `SCHEMA_PATH` | Absolute path to a reviewed current workbook mapping | Absolute path to the deployed reviewed mapping |
| `ALLOW_SYNTHETIC_FIXTURES` | `false` for real-provider acceptance testing | `false` when activating real workbook support |
| `TEMP_STORE_DIR` | `.feedfix` | `/data/feedfix` on the private persistent volume |
| `FILE_TTL_MINUTES` | `59` | `59` |

`STRIPE_SECRET_KEY` accepts restricted keys despite its historical variable name. Create a dedicated restricted key for Checkout Session creation and refund creation, with the related permissions required by those requests. Verify the exact permission set in a sandbox, including inline product/price creation and the refund path; use Stripe request logs to resolve permission errors. Do not give the runtime key catalog or webhook administration permissions just for initial setup.

The Stripe connector's account access does not populate the application's API key. Store that key directly in the deployment's secret variables. Sandbox keys, live keys, CLI signing secrets and deployed endpoint signing secrets are not interchangeable.

## Setup sequence

1. Select the Stripe account and mode. The user confirmed **Nubiaris in live mode** (`acct_1TuLOTFDy6uvJQBt`) for the existing USD 4.99 optional-support model on September 5, 2026. Do not use test cards in live mode.
2. Complete the reviewed official-workbook roundtrip and golden evidence described in [the schema integration guide](walmart-schema-integration.md). Setting keys alone cannot enable payments for synthetic or unsupported workbooks. Do not change evidence flags to bypass this requirement.
3. Create a restricted sandbox key and configure the local values above. Install/authenticate Stripe CLI against that sandbox, then forward these events:

   ```bash
   stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to localhost:3000/api/webhook
   ```

4. Save the listener's signing secret as `STRIPE_WEBHOOK_SECRET`, restart the app, upload an eligible reviewed workbook, download the corrected XLSX, and open optional support. Complete the actual app-created Checkout using Stripe sandbox payment details. Verify the signed webhook confirms support and repeated delivery does not double-count it. A generic `stripe trigger` event cannot satisfy the app's analysis/session checks.
5. Verify cancellation preserves free downloads, invalid signatures are rejected, mismatched amounts/sessions cannot mark support paid, and a late confirmed payment after record expiry is refunded once. Exercise the refund permission in the sandbox as well as Checkout creation.
6. In the selected live account, register `https://feedfix.app/api/webhook` for **events on this account**, selecting `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Use a snapshot event payload compatible with the installed Stripe SDK, not a thin event destination. Check for an existing endpoint at this URL before creating another.
7. Store the endpoint signing secret and dedicated live restricted key in Railway, set the production variables above, and redeploy the existing FeedFix service. Keep the single persistent-volume replica described in [RAILWAY.md](../RAILWAY.md).
8. Verify webhook delivery in Stripe Workbench and perform an explicitly authorized real-payment smoke test only after sandbox acceptance passes. Check that support is confirmed by the webhook, not merely by the success redirect.

Checkout can start within 15 minutes of analysis creation and expires at creation +45 minutes. Downloads remain free until analysis expiry. Delayed confirmations for expired records are refunded idempotently.

## Setup status

- Existing code implements hosted Checkout, server-side pricing, signed webhooks and late-payment refunds.
- The local `.env` has empty Stripe API and webhook secrets and an empty `SCHEMA_PATH`.
- Created live webhook `we_1UCOqyFDy6uvJQBtJOjKBBxi` at `https://feedfix.app/api/webhook`, with the two Checkout events above and API version `2026-08-26.dahlia`, matching the installed SDK. No previous webhook endpoints existed in this account.
- Saved and verified its signing secret in Railway project `8dc0aec0-daa2-4724-a8d1-e914c6c98e46` (Homire), environment `FeedFix` (`56ed7837-95c0-419b-b0c1-854fae8d60f5`), service `feedfix` (`ee8943cc-40d1-4b34-845d-7c73e9adbae8`). The secret is not stored in this repository. The variable update used `--skip-deploys`; runtime activation still requires redeployment.
- Verified Railway already has `APP_URL=https://feedfix.app`, `PAYMENT_MODE=stripe`, and `STRIPE_PRICE_AMOUNT=499`. `STRIPE_SECRET_KEY` and `SCHEMA_PATH` are absent.
- The connector cannot create a restricted API key. The operator must create it in the selected Stripe account and save it directly as `STRIPE_SECRET_KEY` in the specific Railway service above. Do not paste it into chat or commit it.
- No real charge or deployment was performed. Activation requires the API key, reviewed workbook evidence, redeployment and runtime validation. Local mock mode remains available for synthetic fixture testing.

## References

- [Stripe Checkout inline prices](https://docs.stripe.com/payments/checkout/migrating-prices)
- [Stripe webhook setup and signatures](https://docs.stripe.com/webhooks)
- [Restricted API keys](https://docs.stripe.com/keys/restricted-api-keys)
- Local Next.js environment guide: `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`.
