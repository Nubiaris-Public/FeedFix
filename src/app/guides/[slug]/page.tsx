import Link from "next/link";
import { notFound } from "next/navigation";
import { guides } from "../../../content-guides";
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
  return contentMetadata(
    `/guides/${g.slug}`,
    `${g.title} | FeedFix`,
    g.description,
  );
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
        <p className="lede">{g.description}</p>
        <p className="editorial-note">
          By FeedFix · Reviewed September 5, 2026 · Examples are illustrative,
          not Walmart acceptance evidence.
        </p>
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
      <aside className="support-note">
        <h2>Check what FeedFix supports</h2>
        <p>
          <Link href="/supported-templates">Review template compatibility</Link>{" "}
          before using the <Link href="/">file checker</Link>.
        </p>
      </aside>
      <section className="related-guides">
        <h2>Related guides</h2>
        <ul>
          {guides
            .filter((x) => x.slug !== g.slug)
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
          }).replace(/</g, "\\u003c"),
        }}
      />
    </ContentShell>
  );
}
