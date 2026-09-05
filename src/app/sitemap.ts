import type { MetadataRoute } from "next";
import { seoSettings } from "../server/seo";
export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  const { origin, indexable } = seoSettings();
  return indexable ? [{ url: origin + "/" }] : [];
}
