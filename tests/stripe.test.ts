import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const { createSession, refund } = vi.hoisted(() => ({
  createSession: vi.fn(),
  refund: vi.fn(),
}));
vi.mock("stripe", async (importOriginal) => {
  const { default: Stripe } = await importOriginal<typeof import("stripe")>();
  return {
    default: class extends Stripe {
      constructor(...args: ConstructorParameters<typeof Stripe>) {
        super(...args);
        this.checkout.sessions.create = createSession;
        this.refunds.create = refund;
      }
    },
  };
});
let directory: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "feedfix-stripe-"));
  vi.stubEnv("TEMP_STORE_DIR", directory);
  vi.stubEnv("USAGE_LOG_PATH", join(directory, "metrics", "usage.json"));
  vi.stubEnv("PAYMENT_MODE", "stripe");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake_no_network");
  vi.stubEnv("SCHEMA_PATH", "");
  vi.stubEnv("APP_URL", "http://localhost:3000");
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
it("creates server-priced idempotent Checkout and refunds a late confirmed payment", async () => {
  const { analyze, download } = await import("../src/server/service");
  const { store } = await import("../src/server/store");
  const { checkout, fulfillEvent } = await import("../src/server/payment");
  const { analysis, token } = await analyze(
    await readFile("tests/fixtures/walmart/multiple-errors.xlsx"),
  );
  // Test only: emulate a reviewed template record to reach the real-provider branch.
  const record = await store.get(analysis.id);
  // Explicit provider-unit-test double, not a promoted fixture or golden evidence.
  const evidenceModule = await import("../src/engine/evidence");
  const evidenceMock = vi
    .spyOn(evidenceModule, "supportEvidence")
    .mockReturnValue({
      origin: "WALMART_CURRENT_SUPPORTED",
      paidSupportEligible: true,
      schemaSha256: record!.schemaSha256,
      mappingSha256: record!.mappingSha256!,
    });
  await store.put({
    ...record!,
    synthetic: false,
    origin: "WALMART_CURRENT_SUPPORTED",
    paidSupportEligible: true,
  });
  createSession.mockResolvedValue({
    id: "cs_fixture",
    url: "https://checkout.stripe.com/test-fixture",
  });
  await download(analysis.id, token);
  await checkout(analysis.id, token);
  await checkout(analysis.id, token);
  evidenceMock.mockReturnValueOnce({
    origin: "WALMART_CURRENT_SUPPORTED",
    paidSupportEligible: false,
    schemaSha256: record!.schemaSha256,
    mappingSha256: record!.mappingSha256!,
  });
  await expect(checkout(analysis.id, token)).rejects.toThrow(/evidence/);
  expect(createSession).toHaveBeenCalledTimes(1);
  const [params, options] = createSession.mock.calls[0];
  expect(params.mode).toBe("payment");
  expect(params.line_items[0].price_data.product_data.name).toContain(
    "optional support",
  );
  expect(params.line_items[0].price_data.unit_amount).toBe(499);
  expect(params.metadata).toEqual({ analysisId: analysis.id });
  expect(JSON.stringify(params)).not.toContain(token);
  expect(options.idempotencyKey).toBe("checkout-" + analysis.id);
  await store.delete(analysis.id);
  refund.mockResolvedValue({ id: "re_test" });
  const event = {
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_fixture",
        payment_status: "paid",
        mode: "payment",
        currency: "usd",
        client_reference_id: analysis.id,
        metadata: { analysisId: analysis.id },
        payment_intent: "pi_fixture",
      },
    },
  } as unknown as import("stripe").default.Event;
  await fulfillEvent(event);
  evidenceMock.mockRestore();
  expect(refund).toHaveBeenCalledWith(
    { payment_intent: "pi_fixture" },
    { idempotencyKey: "expired-cs_fixture" },
  );
});
