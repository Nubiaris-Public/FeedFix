import type { MetadataRoute } from "next";
import { seoSettings } from "../server/seo";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  const { origin, indexable } = seoSettings();
  // Allow crawling so Google can observe noindex. robots.txt is not access control.
  return {
    rules: { userAgent: "*", allow: "/" },
    ...(indexable ? { sitemap: origin + "/sitemap.xml" } : {}),
  };
}
