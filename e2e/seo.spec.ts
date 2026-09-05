import { test, expect } from "@playwright/test";
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
