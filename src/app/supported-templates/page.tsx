import Link from "next/link";
import { contentMetadata, supportedWorkbookConfigured } from "../../server/seo";
import { getSchema } from "../../engine/schema";
import ContentShell from "../content-shell";
export const dynamic = "force-dynamic";
export function generateMetadata() {
  return contentMetadata(
    "/supported-templates",
    "Walmart Template Compatibility & Limits | FeedFix",
    "Check FeedFix's current Walmart workbook support, preview limitations, safe correction policy and what happens to uploaded spreadsheets.",
  );
}
export default function SupportedTemplates() {
  const supported = supportedWorkbookConfigured();
  const schema = supported ? getSchema() : null;
  return (
    <ContentShell>
      <p className="eyebrow">Compatibility and limits</p>
      <h1>Know what your file checker can verify.</h1>
      <section className="support-note">
        <h2>
          {supported
            ? "A reviewed workbook mapping is configured"
            : "Preview: current Walmart workbooks are not yet verified"}
        </h2>
        <p>
          {schema
            ? `This deployment has reviewed evidence for mapping ${schema.version}, worksheet ${schema.sheet}. Other versions and layouts are not automatically supported.`
            : "FeedFix is currently a preview. No reviewed current Walmart workbook mapping is enabled. Synthetic examples test the software; they do not demonstrate that your Walmart spreadsheet can be analyzed or accepted."}
        </p>
        <p>
          Sharing an unsupported workbook for temporary study does not make it
          supported. When several structural signals identify a Walmart layout
          we do not support, the result offers optional private sharing. Your
          original is unchanged and no corrections or checkout are offered.
        </p>
      </section>
      <section>
        <h2>What safe correction means</h2>
        <p>
          On an explicitly supported mapping, FeedFix validates the configured
          rules and proposes only unambiguous changes. It patches approved cells
          in a copy of the original workbook package and checks structural
          integrity. It does not invent identifiers, product facts or choices
          from a list.
        </p>
        <p>
          A repaired workbook is checked again. Unresolved issues still require
          review. Neither passing local checks nor downloading a corrected file
          guarantees Walmart acceptance.
        </p>
      </section>
      <section>
        <h2>File and processing limits</h2>
        <p>
          The engine accepts plain XLSX packages within its safety limits, with
          a maximum of 25 MB and 10,000 item rows; deployment upload limits may
          be lower. Macros, external links, encrypted workbooks and unsafe
          embedded content are not supported. Formula results are not calculated
          by FeedFix.
        </p>
        <p>
          An optional processing report can be supplied as XLSX or CSV. Its
          columns must match the configured report mapping. Analysis,
          corrections and downloads are free; optional contributions do not
          unlock template compatibility.
        </p>
      </section>
      <section>
        <h2>How uploaded files are handled</h2>
        <p>
          Analysis files are temporary. Download your results before the
          one-hour expiry. We do not connect to your Walmart account.
        </p>
        <p>
          If you explicitly agree to share a study copy, the original and its
          structural report are kept privately for up to one hour. Aggregate
          structural counters and independent synthetic test results may remain
          to prioritize engineering work, as explained in the consent. Product
          rows and uploaded workbooks are not retained as a permanent training
          corpus.
        </p>
        <p>
          You can delete the study copy early while its deletion control remains
          available. Automated cleanup runs while the service is operating;
          expired copies are cleaned on startup after an outage.
        </p>
      </section>
      <section>
        <h2>Optional template notifications</h2>
        <p>
          After sharing a new template, you can separately request an update
          about support for that layout. We keep the email privately for up to
          30 days, solely for this request. No account, newsletter or email is
          automatically created or sent. You can remove the request while its
          control remains available; otherwise it expires. Workbook copies still
          expire within one hour.
        </p>
      </section>
      <section>
        <h2>Why a schema is not workbook certification</h2>
        <p>
          An official API schema defines data rules. An Excel template also has
          headers, repeated fields, hidden sheets and metadata that need a
          reviewed mapping. Legacy real workbooks and synthetic tests cannot
          automatically establish compatibility with a current template.
        </p>
        <p>
          FeedFix is independent of Walmart and does not claim official
          endorsement. Consult{" "}
          <Link href="/guides">the troubleshooting guides</Link> or return to
          the <Link href="/">file checker preview</Link>.
        </p>
      </section>
    </ContentShell>
  );
}
