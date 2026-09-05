import { afterEach, expect, it, vi } from "vitest";
import { homeMetadata } from "../src/server/seo";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";
afterEach(() => vi.unstubAllEnvs());
it("keeps preview deployments out of the index by default", () => {
  vi.stubEnv("APP_URL", "https://preview.example.com");
  vi.stubEnv("SEO_INDEXABLE", "false");
  vi.stubEnv("SCHEMA_PATH", "");
  expect(homeMetadata().robots).toEqual({ index: false, follow: true });
  expect(homeMetadata().title).toContain("Preview");
  expect(sitemap()).toEqual([]);
  expect(robots().sitemap).toBeUndefined();
});
it("uses only the configured origin and keeps analysis links out of the index", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SEO_INDEXABLE", "true");
  vi.stubEnv("APP_URL", "https://feedfix.example.com/?token=never-publish");
  expect(sitemap()).toEqual([{ url: "https://feedfix.example.com/" }]);
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
