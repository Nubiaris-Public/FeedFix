import { test, expect } from "@playwright/test";
import { newTemplateBytes } from "../tests/helpers/new-template";
async function upload(page: import("@playwright/test").Page, bytes: Buffer) {
  await page.goto("/");
  await expect(page.getByRole("main")).toHaveAttribute(
    "data-clarity-mask",
    "true",
  );
  await page.locator("#workbook").setInputFiles({
    name: "new-layout.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: bytes,
  });
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/analyze"),
  );
  await page.getByRole("button", { name: "Analyze file — free" }).click();
  return response;
}
test("new template → opt-in private share → optional callback → early deletion", async ({
  page,
}, info) => {
  const response = await upload(page, await newTemplateBytes());
  expect((await response.json()).status).toBe("NEW_WALMART_TEMPLATE");
  await expect(
    page.getByRole("heading", { name: "Walmart file detected" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your original file was not modified.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Download corrected|Support FeedFix/ }),
  ).toHaveCount(0);
  const share = page.getByRole("button", {
    name: "Share securely",
    exact: true,
  });
  await expect(share).toBeDisabled();
  const consent = page.getByRole("checkbox");
  await expect(consent).not.toBeChecked();
  await consent.check();
  await share.click();
  await expect(
    page.getByRole("heading", {
      name: "Thanks — this template is now under review",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/feedfix-new-template-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel("Email (optional)").fill("seller@example.test");
  await page.getByRole("button", { name: "Notify me", exact: true }).click();
  await expect(
    page.getByText(/Your notification request is saved/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete study copy now" }).click();
  await expect(page.getByText("Your study copy was deleted.")).toBeVisible();
  await page
    .getByRole("button", { name: "Remove notification request" })
    .click();
  await expect(
    page.getByText("Share a new study copy to request a notification."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("declining sharing returns to the uploader without an error", async ({
  page,
}) => {
  let shares = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/study-share")) shares++;
  });
  await upload(page, await newTemplateBytes());
  const declined = page.waitForRequest(
    (r) =>
      r.url().endsWith("/api/events") &&
      r.postData()?.includes("template_share_declined") === true,
  );
  await page.getByRole("button", { name: "Continue without sharing" }).click();
  await declined;
  await expect(page.locator("#workbook")).toBeAttached();
  expect(shares).toBe(0);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});
test("generic spreadsheets are honest results and corrupt XLSX stays an error", async ({
  page,
}) => {
  const generic = await upload(page, await newTemplateBytes(true));
  expect((await generic.json()).status).toBe("UNKNOWN_SPREADSHEET");
  await expect(
    page.getByRole("heading", { name: "Spreadsheet received" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Walmart file detected" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Share securely" }),
  ).toHaveCount(0);
  const corrupt = await upload(page, Buffer.from("not an XLSX"));
  expect(corrupt.status()).toBe(400);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Walmart file detected" }),
  ).toHaveCount(0);
});
