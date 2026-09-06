import { test as base } from "@playwright/test";
// Model separate visitors through the existing trusted-proxy boundary in the
// local E2E server. Keep production rate limits unchanged.
export const test = base.extend({
  extraHTTPHeaders: async ({}, provide, info) => {
    await provide({ "x-feedfix-test-visitor": info.testId });
  },
});
export { expect } from "@playwright/test";
