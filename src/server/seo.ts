import { getSchema } from "../engine/schema";
import { hasCurrentWorkbookSupport } from "../engine/evidence";
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

export function supportedWorkbookConfigured() {
  try {
    return hasCurrentWorkbookSupport(getSchema());
  } catch {
    return false;
  }
}

export function homeMetadata(privateResult = false): Metadata {
  const preview = !supportedWorkbookConfigured();
  const title = preview
    ? "Walmart Item Setup File Checker — Preview | FeedFix"
    : "Free Walmart Item Setup File Checker | FeedFix";
  const description = preview
    ? "Preview FeedFix's spreadsheet error checker with synthetic examples. Official Walmart templates are not yet enabled. No account required."
    : "Check supported Walmart item setup XLSX files for errors. Download safe corrections and a change report free. No Walmart login required.";
  return contentMetadata("/", title, description, privateResult);
}

export function contentMetadata(
  path: string,
  title: string,
  description: string,
  privateResult = false,
): Metadata {
  const { origin, indexable } = seoSettings();
  return {
    metadataBase: new URL(origin),
    title,
    description,
    icons: { icon: "/icon.svg" },
    alternates: { canonical: origin + path },
    robots: { index: indexable && !privateResult, follow: true },
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined },
    openGraph: {
      type: "website",
      siteName: "FeedFix",
      locale: "en_US",
      url: origin + path,
      title,
      description,
      images: [
        {
          url: origin + "/social-image",
          width: 1200,
          height: 630,
          alt: "FeedFix — Walmart spreadsheet error guides and file checker",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [origin + "/social-image"],
    },
  };
}
