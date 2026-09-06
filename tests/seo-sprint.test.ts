import { afterEach, expect, it, vi } from "vitest";
import {
  guides,
  publishedGuides,
  documentedRules,
} from "../src/content-guides";
import {
  guideLinks,
  examples,
  navigationContext,
  publicContext,
  classifySource,
} from "../src/shared/guide-context";
import { decode, approvedSources } from "../src/decoder/knowledge";
import { contentMetadata, homeMetadata } from "../src/server/seo";
import sitemap from "../src/app/sitemap";
afterEach(() => vi.unstubAllEnvs());
it("publishes exactly five complete unique guides with reviewed evidence", () => {
  expect(publishedGuides).toHaveLength(5);
  for (const key of ["slug", "title", "seoTitle", "description"] as const)
    expect(new Set(guides.map((g) => g[key])).size).toBe(5);
  expect(publishedGuides.map((g) => g.slug)).toEqual(
    guideLinks.map((g) => g.slug),
  );
  for (const g of publishedGuides) {
    expect(g.status).toBe("published");
    expect(g.editor).toBe("FeedFix");
    expect(g.reviewedAt).toBe("2026-09-06");
    expect(g.publishedAt).toBeUndefined();
    expect(g.answer.length).toBeGreaterThan(50);
    expect(g.uncertain).toBeTruthy();
    expect(
      g.sections.some((s) =>
        s.paragraphs.some((p) => /synthetic|illustrative/i.test(p)),
      ),
    ).toBe(true);
    expect(
      g.related.every(
        (id) => id !== g.slug && publishedGuides.some((x) => x.slug === id),
      ),
    ).toBe(true);
    for (const source of g.sources)
      expect(
        approvedSources.includes(source.url) ||
          source.url ===
            "https://www.gs1.org/services/how-calculate-check-digit-manually",
      ).toBe(true);
    expect(documentedRules(g).length).toBeGreaterThan(0);
    expect(decode(examples[g.exampleId]).status).not.toBe("UNKNOWN");
  }
});
it("produces unique parameter-free metadata and approved sitemap routes", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SEO_INDEXABLE", "true");
  vi.stubEnv("APP_URL", "https://feedfix.example/?token=PRIVATE");
  const metadata = publishedGuides.map((g) =>
    contentMetadata(`/guides/${g.slug}`, g.seoTitle, g.description),
  );
  expect(new Set(metadata.map((m) => m.alternates?.canonical)).size).toBe(5);
  expect(JSON.stringify(metadata)).not.toContain("PRIVATE");
  expect(sitemap()).toHaveLength(8);
  expect(homeMetadata().description).toContain("No account or file required");
  vi.stubEnv("SEO_INDEXABLE", "false");
  expect(sitemap()).toEqual([]);
});
it("accepts only approved public navigation without redirect or free text", () => {
  expect(
    navigationContext(
      new URLSearchParams(
        "guide=PRIVATE&action=file&redirect=https://evil.test",
      ),
    ).guide,
  ).toBeUndefined();
  expect(
    navigationContext(new URLSearchParams("guide=PRIVATE&action=file")).action,
  ).toBe("error");
  expect(
    publicContext({
      guide_id: "sku-private",
      source: "secret",
      message: "private",
    }),
  ).toEqual({ source: "unknown" });
  expect(
    navigationContext(
      new URLSearchParams("guide=walmart-sku-already-used&action=example"),
    ).guide?.example,
  ).toBe("sku-reused");
});
it("distinguishes paid markers from search referrals without claiming organic attribution", () => {
  expect(
    classifySource(
      "https://feedfix.app/?gclid=PRIVATE",
      "https://www.google.com/search?q=PRIVATE",
    ),
  ).toBe("paid");
  expect(
    classifySource(
      "https://feedfix.app/",
      "https://www.google.com/search?q=PRIVATE",
    ),
  ).toBe("search_referral");
  expect(classifySource("https://feedfix.app/", "")).toBe("unknown");
  expect(
    classifySource(
      "https://feedfix.app/",
      "https://google.com.evil.test/private",
    ),
  ).toBe("referral");
});
