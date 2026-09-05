import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Fix Walmart Item Setup Errors Online | FeedFix",
  description:
    "Upload your rejected Walmart item setup spreadsheet, identify errors and download a corrected file. No Walmart login required.",
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
