import Link from "next/link";
import { guides } from "../../content-guides";
import { contentMetadata } from "../../server/seo";
import ContentShell from "../content-shell";
export const dynamic = "force-dynamic";
export function generateMetadata() {
  return contentMetadata(
    "/guides",
    "Walmart Spreadsheet Error Guides | FeedFix",
    "Practical guides to Walmart item setup errors: product identifiers, required fields, allowed values and processing reports. Learn what can be safely corrected.",
  );
}
export default function Guides() {
  return (
    <ContentShell>
      <p className="eyebrow">Walmart item setup resources</p>
      <h1>Understand the error before changing the file.</h1>
      <p className="lede">
        Practical checks for sellers reviewing a rejected spreadsheet. These
        guides explain the workflow; they do not certify that a workbook is
        supported by FeedFix.
      </p>
      <div className="guide-list">
        {guides.map((g) => (
          <section key={g.slug}>
            <h2>
              <Link href={`/guides/${g.slug}`}>{g.title}</Link>
            </h2>
            <p>{g.description}</p>
          </section>
        ))}
      </div>
      <aside className="support-note">
        <h2>Before you upload</h2>
        <p>
          Check the{" "}
          <Link href="/supported-templates">current compatibility status</Link>.
          A correct product record, a valid spreadsheet and acceptance by
          Walmart are separate checks.
        </p>
      </aside>
    </ContentShell>
  );
}
