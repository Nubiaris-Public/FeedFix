import Stripe from "stripe";
import { config } from "./config";
import { authorize, store } from "./store";
import { track } from "./analytics";
export function stripe() {
  const c = config();
  if (!c.secret && !c.mock)
    throw new Error("Checkout is not configured yet. Please try again later.");
  return new Stripe(c.secret ?? "sk_test_mock", {
    timeout: 10000,
    maxNetworkRetries: 1,
  });
}
export async function checkout(id: string, token: string) {
  const c = config(),
    record = await authorize(id, token);
  if (record.status === "PAID")
    throw new Error(
      "Thank you — your optional support payment is already confirmed.",
    );
  if (!record.plan.length)
    throw new Error(
      "There are no automatic corrections to support for this analysis.",
    );
  if (record.synthetic && !c.mock)
    throw new Error(
      "Synthetic fixtures cannot receive real support payments. Configure a reviewed official template first.",
    );
  if (
    Date.now() - record.createdAt > 15 * 60000 ||
    record.expiresAt - Date.now() < 31 * 60000
  )
    throw new Error(
      "The optional support window has closed. Your free downloads remain available until their expiry.",
    );
  if (!record.generated)
    throw new Error(
      "Download your corrected file for free before choosing optional support.",
    );
  if (record.checkoutUrl) return { url: record.checkoutUrl };
  if (c.mock) {
    record.sessionId = "cs_test_" + id;
    record.checkoutUrl = c.appUrl + "/?mock=" + id;
  } else {
    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: id,
        metadata: { analysisId: id },
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: record.amount,
              product_data: {
                name: "FeedFix — optional support (downloads are free)",
              },
            },
            quantity: 1,
          },
        ],
        success_url: c.appUrl + "/?analysis=" + id + "&support=1",
        cancel_url: c.appUrl + "/?analysis=" + id + "&cancelled=1",
        expires_at: Math.floor(record.createdAt / 1000) + 2700,
        excluded_payment_method_types: [
          "acss_debit",
          "au_becs_debit",
          "bacs_debit",
          "boleto",
          "customer_balance",
          "konbini",
          "oxxo",
          "sepa_debit",
          "us_bank_account",
        ],
        integration_identifier:
          "feedfix_" +
          id
            .slice(0, 8)
            .replace(/[0-9]/g, (n) => String.fromCharCode(103 + Number(n))),
      },
      { idempotencyKey: "checkout-" + id },
    );
    if (!session.url)
      throw new Error("Checkout could not be opened. Please retry.");
    record.sessionId = session.id;
    record.checkoutUrl = session.url;
  }
  await store.put(record);
  track("checkout_started", { auto_fix_count: record.plan.length });
  return { url: record.checkoutUrl };
}
export async function fulfillEvent(event: Stripe.Event) {
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ].includes(event.type)
  )
    return;
  const s = event.data.object as Stripe.Checkout.Session;
  if (
    s.payment_status !== "paid" ||
    s.mode !== "payment" ||
    s.currency !== "usd"
  )
    return;
  const id = s.metadata?.analysisId;
  if (!id || !/^[a-f0-9]{64}$/.test(id) || s.client_reference_id !== id) return;
  const record = await store.get(id);
  if (!record) {
    if (s.payment_intent && !config().mock)
      await stripe().refunds.create(
        {
          payment_intent:
            typeof s.payment_intent === "string"
              ? s.payment_intent
              : s.payment_intent.id,
        },
        { idempotencyKey: "expired-" + s.id },
      );
    return;
  }
  if (s.id !== record.sessionId || s.amount_total !== record.amount)
    throw new Error("Payment verification did not match this analysis.");
  if (record.status === "PAID") return;
  record.status = "PAID";
  await store.put(record);
  track("payment_completed");
}
export async function webhook(body: string, signature: string) {
  const secret =
    config().webhookSecret ??
    (config().mock ? "whsec_feedfix_local_test" : undefined);
  if (!secret) throw new Error("Webhook is not configured.");
  const event = stripe().webhooks.constructEvent(body, signature, secret);
  await fulfillEvent(event);
}
export async function mockPayment(id: string, token: string) {
  if (!config().mock) throw new Error("Test payments are unavailable.");
  const record = await authorize(id, token);
  if (!record.sessionId) throw new Error("Start checkout first.");
  const payload = JSON.stringify({
    id: "evt_mock_" + id,
    type: "checkout.session.completed",
    data: {
      object: {
        id: record.sessionId,
        client_reference_id: id,
        metadata: { analysisId: id },
        payment_status: "paid",
        mode: "payment",
        currency: "usd",
        amount_total: record.amount,
      },
    },
  });
  const signature = stripe().webhooks.generateTestHeaderString({
    payload,
    secret: config().webhookSecret ?? "whsec_feedfix_local_test",
  });
  await webhook(payload, signature);
}
