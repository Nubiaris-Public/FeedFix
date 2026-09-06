import { navigationContext } from "../shared/guide-context";
import FeedFix from "./utility";
import { config } from "../server/config";
import {
  homeMetadata,
  seoSettings,
  supportedWorkbookConfigured,
} from "../server/seo";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return homeMetadata(
    [
      "analysis",
      "support",
      "cancelled",
      "token",
      "mock",
      "guide",
      "action",
    ].some((key) => key in params),
  );
}
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialNavigation = navigationContext(
    new URLSearchParams({
      guide: typeof params.guide === "string" ? params.guide : "",
      action: typeof params.action === "string" ? params.action : "",
    }),
  );
  const c = config();
  const { origin } = seoSettings();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "FeedFix",
            description:
              "Free Walmart error explanations with official references. No account or file required for an explanation.",
            url: origin + "/",
            inLanguage: "en",
          }).replace(/</g, "\\u003c"),
        }}
      />
      <FeedFix
        initialNavigation={initialNavigation}
        amount={c.amount}
        maxUpload={c.maxUpload}
        demo={!supportedWorkbookConfigured()}
        mock={c.mock}
      />
    </>
  );
}
