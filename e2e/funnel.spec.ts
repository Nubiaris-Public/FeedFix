import { test, expect } from "./fixtures";
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) =>
    console.error("Browser error:", error.message),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      console.error("Browser console:", message.text());
  });
});
test("free download, optional feedback and optional support", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Check an Excel file", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Walmart item setup file checker/ }),
  ).toBeVisible();
  await page
    .locator("#workbook")
    .setInputFiles("tests/fixtures/walmart/multiple-errors.xlsx");
  await page.getByRole("button", { name: "Analyze file — free" }).click();
  await expect(
    page.getByRole("heading", { name: "Analysis complete" }),
  ).toBeVisible();
  await expect(
    page.getByText("2 items analyzed · 5 issues detected"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "2 issues can be corrected automatically",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Support FeedFix — $4.99 (optional)" }),
  ).toHaveCount(0);
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download corrected XLSX — free" })
    .click();
  expect((await downloaded).suggestedFilename()).toBe("feedfix-corrected.xlsx");
  await page
    .getByRole("button", { name: "Haven’t tried yet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Haven’t tried yet", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("region", { name: "Optional support" }),
  ).toContainText(
    "Payment does not guarantee Walmart acceptance or certify template compatibility.",
  );
  await page
    .getByRole("button", { name: "Support FeedFix — $4.99 (optional)" })
    .click();
  await page.getByRole("button", { name: "Simulate optional payment" }).click();
  await expect(
    page.getByText("Thank you for your support!", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download corrected XLSX — free" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "/tmp/feedfix-free-results.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("landing and invalid upload feedback", async ({ page }, info) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Check an Excel file", exact: true })
    .click();
  await page.screenshot({
    path: `/tmp/feedfix-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Analyze file — free" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Choose your XLSX workbook first.",
  );
  await page.locator("#workbook").setInputFiles({
    name: "hostile.xlsm",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("fake"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "XLSM is not supported",
  );
});

test("optional study copy has explicit consent and can be deleted early", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Check an Excel file", exact: true })
    .click();
  await page
    .getByText("Help improve template support — optional", { exact: true })
    .click();
  const consent = page.getByRole("checkbox", {
    name: /Help improve Walmart template support/,
  });
  await expect(consent).not.toBeChecked();
  await page
    .locator("#workbook")
    .setInputFiles("tests/fixtures/walmart/valid.xlsx");
  await consent.check();
  await page.getByRole("button", { name: "Analyze file — free" }).click();
  await expect(
    page.getByRole("heading", { name: "Analysis complete" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Private study copies" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete study copy now" }).click();
  await expect(
    page.getByText("Study copy deleted. Your analysis is unchanged."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Private study copies" }),
  ).toHaveCount(0);
});
