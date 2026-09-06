import { publishedGuides as guides } from "../content-guides";
import type { MetadataRoute } from "next";
import { seoSettings } from "../server/seo";
export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  const { origin, indexable } = seoSettings();
  return indexable
    ? [
        "/",
        "/guides",
        "/supported-templates",
        ...guides.map((g) => "/guides/" + g.slug),
      ].map((path) => ({ url: origin + path }))
    : [];
}
