import { test, expect } from "./fixtures";
import { guideLinks } from "../src/shared/guide-context";
test("five guides deliver initial HTML without JavaScript and private metadata stays clean", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const g of guideLinks) {
    const response = await page.goto(`http://127.0.0.1:3100/guides/${g.slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "What the error confirms" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Official references" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Try a related example (new tab)" }),
    ).toHaveAttribute("href", `/?guide=${g.slug}&action=example`);
  }
  await context.close();
  const privatePage = await request.get(
    "/?analysis=PRIVATE&token=SECRET&guide=INVALID",
  );
  const html = await privatePage.text();
  // Inspect metadata/JSON-LD only; an encoded request can occur in Next's router payload.
  const metadata =
    html
      .match(
        /<(?:meta|link)\b[^>]*>|<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
      )
      ?.join("") ?? "";
  expect(metadata).not.toMatch(/PRIVATE|SECRET|INVALID/);
  expect(metadata).toContain("noindex");
  expect((await request.get("/guides/invalid-slug")).status()).toBe(404);
});
test("guide to explicit example preserves original inputs and file selection never sends it", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByLabel("Walmart error message", { exact: true })
    .fill("My unsent diagnostic");
  await page
    .getByRole("button", { name: "Check an Excel file", exact: true })
    .click();
  await page
    .locator("#workbook")
    .setInputFiles("tests/fixtures/walmart/valid.xlsx");
  const opened = page.waitForEvent("popup");
  await page
    .getByRole("link", {
      name: "Missing attribute metadata (new tab)",
      exact: true,
    })
    .click();
  const guide = await opened;
  guide.on("pageerror", (e) => errors.push(e.message));
  await expect(guide.getByRole("heading", { level: 1 })).toContainText(
    "metadata",
  );
  await guide.screenshot({
    path: info.outputPath("guide.png"),
    fullPage: true,
  });
  const toolOpened = guide.waitForEvent("popup");
  await guide
    .getByRole("link", { name: "Try a related example (new tab)", exact: true })
    .click();
  const tool = await toolOpened;
  tool.on("pageerror", (e) => errors.push(e.message));
  await tool.waitForLoadState();
  await expect(
    tool.getByLabel("Walmart error message", { exact: true }),
  ).toHaveValue("");
  await expect(
    tool.getByRole("heading", {
      name: "Missing attribute metadata",
      exact: true,
    }),
  ).toHaveCount(0);
  const requests: string[] = [];
  tool.on("request", (r) => {
    if (r.method() === "POST") requests.push(new URL(r.url()).pathname);
  });
  const response = tool.waitForResponse((r) =>
    r.url().endsWith("/api/error-decoder"),
  );
  await tool
    .getByRole("button", { name: "Try an example", exact: true })
    .click();
  expect((await (await response).json()).status).toBe("DOCUMENTED");
  await expect(
    tool.getByText(
      "Example — a sample Walmart error, explained by the real decoder.",
    ),
  ).toBeVisible();
  await tool.screenshot({
    path: info.outputPath("guide-to-tool.png"),
    fullPage: true,
  });
  await expect(page.getByText("valid.xlsx", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Paste an error", exact: true })
    .click();
  await expect(
    page.getByLabel("Walmart error message", { exact: true }),
  ).toHaveValue("My unsent diagnostic");
  expect(requests).not.toContain("/api/analyze");
  expect(
    await tool.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await guide.close();
  await tool.close();
});
test("unknown public context falls back safely without automatically explaining or uploading", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") requests.push(new URL(r.url()).pathname);
  });
  await page.goto("/?guide=UNAPPROVED&action=file&example=https://evil.test");
  await expect(
    page.getByRole("button", { name: "Paste an error", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByLabel("Walmart error message", { exact: true }),
  ).toHaveValue("");
  expect(
    requests.filter((p) => p === "/api/error-decoder" || p === "/api/analyze"),
  ).toEqual([]);
});
