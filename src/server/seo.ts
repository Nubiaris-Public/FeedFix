import type { Metadata } from "next";

export function seoSettings() {
  const url = new URL(process.env.APP_URL || "http://localhost:3000");
  const origin = url.origin;
  const indexable =
    process.env.SEO_INDEXABLE === "true" &&
    process.env.NODE_ENV === "production" &&
    url.protocol === "https:";
  return { origin, indexable };
}

export function homeMetadata(privateResult = false): Metadata {
  const { origin, indexable } = seoSettings();
  const preview = !process.env.SCHEMA_PATH;
  const title = preview
    ? "Walmart Item Setup File Checker — Preview | FeedFix"
    : "Free Walmart Item Setup File Checker | FeedFix";
  const description = preview
    ? "Preview FeedFix's spreadsheet error checker with synthetic examples. Official Walmart templates are not yet enabled. No account required."
    : "Check supported Walmart item setup XLSX files for errors. Download safe corrections and a change report free. No Walmart login required.";
  return {
    metadataBase: new URL(origin),
    title,
    description,
    icons: { icon: "/icon.svg" },
    alternates: { canonical: origin + "/" },
    robots: { index: indexable && !privateResult, follow: true },
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined },
    openGraph: {
      type: "website",
      siteName: "FeedFix",
      locale: "en_US",
      url: origin + "/",
      title,
      description,
    },
    twitter: { card: "summary", title, description },
  };
}
