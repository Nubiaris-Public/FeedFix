import { afterEach, expect, it, vi } from "vitest";
import { guides } from "../src/content-guides";
import { homeMetadata, contentMetadata } from "../src/server/seo";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";
afterEach(() => vi.unstubAllEnvs());
it("keeps preview deployments out of the index by default", () => {
  vi.stubEnv("APP_URL", "https://preview.example.com");
  vi.stubEnv("SEO_INDEXABLE", "false");
  vi.stubEnv("SCHEMA_PATH", "");
  expect(homeMetadata().robots).toEqual({ index: false, follow: true });
  expect(homeMetadata().title).toBe(
    "Walmart Item Setup Errors Explained | FeedFix",
  );
  expect(sitemap()).toEqual([]);
  expect(robots().sitemap).toBeUndefined();
});
it("uses only the configured origin and keeps analysis links out of the index", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SEO_INDEXABLE", "true");
  vi.stubEnv("APP_URL", "https://feedfix.example.com/?token=never-publish");
  expect(sitemap()).toEqual(
    [
      "/",
      "/guides",
      "/supported-templates",
      ...guides.map((g) => "/guides/" + g.slug),
    ].map((path) => ({ url: "https://feedfix.example.com" + path })),
  );
  expect(homeMetadata().robots).toEqual({ index: true, follow: true });
  expect(homeMetadata(true).robots).toEqual({ index: false, follow: true });
  expect(homeMetadata().alternates?.canonical).toBe(
    "https://feedfix.example.com/",
  );
  expect(robots().sitemap).toBe("https://feedfix.example.com/sitemap.xml");
});
it("never enables indexing for local HTTP development", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("SEO_INDEXABLE", "true");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  expect(homeMetadata().robots).toEqual({ index: false, follow: true });
});

it("gives content pages unique canonical URLs and social cards without enabling preview indexing", () => {
  vi.stubEnv("APP_URL", "https://preview.example.com/?token=private");
  vi.stubEnv("SEO_INDEXABLE", "false");
  const m = contentMetadata(
    "/guides/example",
    "Example | FeedFix",
    "A useful description",
  );
  expect(m.alternates?.canonical).toBe(
    "https://preview.example.com/guides/example",
  );
  expect(m.robots).toEqual({ index: false, follow: true });
  expect(m.twitter).toMatchObject({
    card: "summary_large_image",
    images: ["https://preview.example.com/social-image"],
  });
  expect(JSON.stringify(m)).not.toContain("token=private");
});
