import { test, expect } from "@playwright/test";
import { guides } from "../src/content-guides";
test("public content is crawlable, navigable and honest about preview support", async ({
  page,
  request,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "What error is Walmart showing you?",
  );
  await expect(page.locator(".intro")).toContainText("supported templates");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Guides", exact: true })
    .click();
  await expect(page).toHaveURL(/\/guides$/);
  const titles = new Set<string>();
  for (const guide of guides) {
    const path = `/guides/${guide.slug}`;
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(
      guide.title.replaceAll("&", "&amp;"),
    );
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      guide.title,
    );
    titles.add(await page.title());
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "http://127.0.0.1:3100" + path,
    );
    expect(
      await page
        .locator('script[type="application/ld+json"]')
        .evaluate((el) => JSON.parse(el.textContent || "{}")),
    ).toMatchObject({ "@type": "BreadcrumbList" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(titles.size).toBe(guides.length);
  await page.screenshot({
    path: testInfo.outputPath("guide.png"),
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Compatibility" })
    .click();
  await expect(
    page.getByRole("heading", { name: /not yet verified/ }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  expect((await request.get("/guides/not-a-real-guide")).status()).toBe(404);
  const image = await request.get("/social-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  expect((await image.body()).subarray(0, 8).toString("hex")).toBe(
    "89504e470d0a1a0a",
  );
  expect(errors).toEqual([]);
});

test("serves search metadata, crawler routes and API noindex", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/FeedFix/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "http://127.0.0.1:3100",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  const structured = JSON.parse(
    await page.locator('script[type="application/ld+json"]').innerText(),
  );
  expect(structured.name).toBe("FeedFix");
  expect((await request.get("/robots.txt")).status()).toBe(200);
  const map = await request.get("/sitemap.xml");
  expect(map.status()).toBe(200);
  expect(await map.text()).not.toContain("<loc>");
  const health = await request.get("/api/health");
  expect(health.headers()["x-robots-tag"]).toContain("noindex");
});
