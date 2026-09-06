import GuideActions from "../../guide-actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  publishedGuides as guides,
  documentedRules,
} from "../../../content-guides";
import { contentMetadata, seoSettings } from "../../../server/seo";
import ContentShell from "../../content-shell";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
async function guideFor({ params }: Props) {
  const { slug } = await params;
  const guide = guides.find((g) => g.slug === slug);
  if (!guide) notFound();
  return guide;
}
export async function generateMetadata(props: Props) {
  const g = await guideFor(props);
  return contentMetadata(`/guides/${g.slug}`, g.seoTitle, g.description);
}
export default async function Guide(props: Props) {
  const g = await guideFor(props);
  const { origin } = seoSettings();
  return (
    <ContentShell>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">FeedFix</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/guides">Guides</Link>
      </nav>
      <article>
        <h1>{g.title}</h1>
        <p className="lede">{g.answer}</p>
        <p>
          <strong>Applies to:</strong> {g.context}
        </p>
        <p className="editorial-note">
          By {g.editor} · Reviewed{" "}
          <time dateTime={g.reviewedAt}>{g.reviewedAt}</time> · Examples are
          synthetic, not Walmart acceptance evidence.
        </p>
        <section>
          <h2>What the error confirms</h2>
          <p>{g.confirms}</p>
          <h3>What it does not tell us</h3>
          <p>{g.uncertain}</p>
        </section>
        {g.sections.map((s) => (
          <section key={s.title}>
            <h2>{s.title}</h2>
            {s.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.steps && (
              <ol>
                {s.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </section>
        ))}
        <section>
          <h2>Shared decoder reference</h2>
          <p>
            The same reviewed rules underpin FeedFix’s explanation. Follow the
            source’s workflow, especially where WFS or API requirements are
            named.
          </p>
          <ul>
            {documentedRules(g).map((rule) => (
              <li key={rule.text}>
                {rule.text} <a href={rule.source}>Official source</a>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>What FeedFix can and cannot do</h2>
          <p>
            FeedFix can explain a recognized error without your file. Workbook
            inspection and safe corrections require a verified compatible
            template. A new layout can be offered separately for optional study;
            it is not an analyzed or repaired workbook. Seller Center catalog
            associations, account decisions and Walmart acceptance require
            review in Walmart.
          </p>
        </section>
        <section>
          <h2>Official references</h2>
          <ul>
            {g.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url}>{s.title}</a>
              </li>
            ))}
          </ul>
          <p>
            Template requirements can change. Consult the source applicable to
            your marketplace, product type and upload.
          </p>
        </section>
      </article>
      <GuideActions id={g.slug} />
      <section className="related-guides">
        <h2>Related guides</h2>
        <ul>
          {guides
            .filter((x) => g.related.includes(x.slug))
            .map((x) => (
              <li key={x.slug}>
                <Link href={`/guides/${x.slug}`}>{x.title}</Link>
              </li>
            ))}
        </ul>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Article",
                headline: g.title,
                description: g.description,
                mainEntityOfPage: origin + "/guides/" + g.slug,
                author: { "@type": "Organization", name: g.editor },
                publisher: { "@type": "Organization", name: "FeedFix" },
                dateModified: g.reviewedAt,
                ...(g.publishedAt ? { datePublished: g.publishedAt } : {}),
                inLanguage: "en",
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "FeedFix",
                    item: origin + "/",
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Guides",
                    item: origin + "/guides",
                  },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: g.title,
                    item: origin + "/guides/" + g.slug,
                  },
                ],
              },
            ],
          }).replace(/</g, "\\u003c"),
        }}
      />
    </ContentShell>
  );
}
