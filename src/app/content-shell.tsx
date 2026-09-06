import Link from "next/link";
export default function ContentShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header>
        <Link className="brand" href="/">
          FeedFix
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/guides">Guides</Link>
          <Link href="/supported-templates">Compatibility</Link>
        </nav>
      </header>
      <main id="content" className="reading-page">
        {children}
      </main>
      <footer className="content-footer">
        <Link href="/">Error decoder</Link>
        <Link href="/guides">All guides</Link>
        <Link href="/supported-templates">Supported templates</Link>
        <p>Independent tool. Not affiliated with Walmart.</p>
      </footer>
    </>
  );
}
