import { expect, test } from "./fixtures";

test("known error gives guidance before upload and reuses the working XLSX flow", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "What error is Walmart showing you?",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Explain this error", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("list", { name: "How FeedFix works" }),
  ).toContainText("Upload your XLSX only when you’re ready.");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByLabel("Walmart error message", { exact: true })
    .fill("Your file is missing attribute metadata in Footwear tab");
  await page
    .getByRole("button", { name: "Explain this error", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Missing attribute metadata",
      exact: true,
    }),
  ).toBeFocused();
  for (const name of [
    "What this means",
    "Why Walmart is rejecting it",
    "How to fix it",
    "Before uploading again",
    "Source",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Walmart Marketplace documentation/ }),
  ).toHaveAttribute(
    "href",
    "https://marketplacelearn.walmart.com/guides/Item%20setup/Troubleshooting/troubleshoot-item-setup-errors",
  );
  await page.screenshot({
    path: `/tmp/feedfix-decoder-known-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Continue with a spreadsheet — optional",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("region", { name: "Upload workbook" }),
  ).toBeFocused();
  await page
    .locator("#workbook")
    .setInputFiles("tests/fixtures/walmart/multiple-errors.xlsx");
  await page.getByRole("button", { name: "Analyze file — free" }).click();
  await expect(
    page.getByRole("heading", { name: "Analysis complete", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("2 items analyzed · 5 issues detected"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("unknown can be declined or shared only after reviewing and consenting", async ({
  page,
}, info) => {
  let shareRequests = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/error-decoder-share")) shareRequests++;
  });
  await page.goto("/");
  const field = page.getByLabel("Walmart error message", { exact: true });
  await field.fill("The moon ate the upload seller@example.test");
  await field.press("Control+Enter");
  await expect(
    page.getByRole("heading", {
      name: "We don't recognize this Walmart error yet.",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Review message to share")).not.toHaveValue(
    /seller@example/,
  );
  await expect(
    page.getByRole("checkbox", { name: /I removed sensitive/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Share reviewed message" }),
  ).toBeDisabled();
  expect(shareRequests).toBe(0);
  await page.getByRole("button", { name: "Continue without sharing" }).click();
  await expect(
    page.getByText("Nothing was shared. You can still check your spreadsheet."),
  ).toBeVisible();
  expect(shareRequests).toBe(0);
  await page.getByRole("button", { name: "Explain another error" }).click();
  await expect(field).toBeFocused();
  await field.fill("The moon ate the upload again");
  await page
    .getByRole("button", { name: "Explain this error", exact: true })
    .click();
  const consent = page.getByRole("checkbox", { name: /I removed sensitive/ });
  await consent.check();
  await page
    .getByLabel("Review message to share")
    .fill(
      'Unknown failure in "North Shop Catalog.xlsx"; Authorization: Bearer do-not-store-me',
    );
  await expect(consent).not.toBeChecked();
  const finalPreview = page.locator(".decoder-final-preview");
  await expect(finalPreview).not.toContainText(
    /North|Shop|Catalog|do-not-store/,
  );
  const reviewed = await finalPreview.textContent();
  await consent.check();
  const shareRequest = page.waitForRequest((r) =>
    r.url().endsWith("/api/error-decoder-share"),
  );
  await page.getByRole("button", { name: "Share reviewed message" }).click();
  expect((await shareRequest).postDataJSON().message).toBe(reviewed);
  await expect(
    page.getByText(/Thanks — your reviewed message was shared/),
  ).toBeVisible();
  expect(shareRequests).toBe(1);
  await page.screenshot({
    path: `/tmp/feedfix-decoder-unknown-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("HTML remains plain text, never executes or reaches analytics or third parties", async ({
  page,
}) => {
  const requests: { url: string; body: string }[] = [];
  page.on("request", (r) =>
    requests.push({ url: r.url(), body: r.postData() || "" }),
  );
  const dialogs: string[] = [];
  page.on("dialog", async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });
  await page.goto("/");
  const payload =
    '<script>alert("decoder-private-marker")</script><img src=x onerror=alert(1)>';
  await page.getByLabel("Walmart error message", { exact: true }).fill(payload);
  await page
    .getByRole("button", { name: "Explain this error", exact: true })
    .click();
  await expect(page.getByLabel("Review message to share")).toHaveValue(payload);
  expect(await page.locator(".decoder img, .decoder script").count()).toBe(0);
  expect(dialogs).toEqual([]);
  expect(
    requests.filter((r) => !r.url.startsWith("http://127.0.0.1:3100")),
  ).toEqual([]);
  expect(
    requests
      .filter((r) => r.url.endsWith("/api/events"))
      .some((r) => r.body.includes("decoder-private-marker")),
  ).toBe(false);
});

test("likely match states uncertainty and errors are accessible", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Walmart error message", { exact: true })
    .fill("Missing required attribute: color");
  await page
    .getByRole("button", { name: "Explain this error", exact: true })
    .click();
  await expect(page.getByText(/Likely match — this resembles/)).toBeVisible();
  await page.getByRole("button", { name: "Explain another error" }).click();
  await page.getByLabel("Walmart error message", { exact: true }).fill("   ");
  await page
    .getByRole("button", { name: "Explain this error", exact: true })
    .click();
  await expect(page.locator(".decoder").getByRole("alert")).toContainText(
    "1–4,000 characters",
  );
});

test("example uses the real decoder and file selection stays local until analysis", async ({
  page,
}) => {
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/analyze")
      uploads.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Paste an error", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#decoder-help")).toHaveText(
    "Free explanation · No account required",
  );
  await expect(
    page.getByRole("complementary", { name: "How your error is processed" }),
  ).toBeVisible();
  await expect(page.locator("#decoder-help")).not.toContainText("SKUs");
  const decoded = page.waitForResponse((response) =>
    response.url().endsWith("/api/error-decoder"),
  );
  await page
    .getByRole("button", { name: "Try an example", exact: true })
    .click();
  expect((await (await decoded).json()).status).toBe("DOCUMENTED");
  await expect(
    page.getByText(
      "Example — a sample Walmart error, explained by the real decoder.",
    ),
  ).toBeVisible();
  for (const name of ["What this means", "How to fix it", "Source"]) {
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", {
      name: "Continue with a spreadsheet — optional",
      exact: true,
    })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Check your Walmart Excel file",
  );
  await expect(
    page.getByRole("list", { name: "How FeedFix works" }),
  ).toContainText("Selecting a file does not upload it.");
  await expect(
    page.getByRole("list", { name: "How FeedFix works" }),
  ).not.toContainText("Understand the error");
  await page
    .locator("#workbook")
    .setInputFiles("tests/fixtures/walmart/valid.xlsx");
  await expect(page.getByText("valid.xlsx", { exact: true })).toBeVisible();
  await expect(page.getByText(/KB · Selected, not uploaded/)).toBeVisible();
  await page
    .getByRole("button", { name: "Paste an error", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Missing attribute metadata",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check an Excel file", exact: true })
    .click();
  await expect(page.getByText("valid.xlsx", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove file", exact: true }).click();
  await expect(page.getByText("valid.xlsx", { exact: true })).toHaveCount(0);
  expect(
    await page
      .locator("#workbook")
      .evaluate((input: HTMLInputElement) => input.files?.length),
  ).toBe(0);
  expect(uploads).toHaveLength(0);
});
