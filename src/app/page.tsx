import FeedFix from "./utility";
import { config } from "../server/config";
import { homeMetadata, seoSettings } from "../server/seo";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return homeMetadata(
    ["analysis", "support", "cancelled", "token"].some((key) => key in params),
  );
}
export default function Home() {
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
            url: origin + "/",
            inLanguage: "en",
          }).replace(/</g, "\\u003c"),
        }}
      />
      <FeedFix
        amount={c.amount}
        maxUpload={c.maxUpload}
        demo={!process.env.SCHEMA_PATH}
        mock={c.mock}
      />
    </>
  );
}
