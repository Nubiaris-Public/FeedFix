import Script from "next/script";
import "./globals.css";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clarityProjectId = process.env.CLARITY_PROJECT_ID?.trim();

  return (
    <html lang="en">
      <body>
        {children}
        {clarityProjectId && /^[a-z0-9]+$/i.test(clarityProjectId) && (
          <Script
            id="microsoft-clarity"
            src={`https://www.clarity.ms/tag/${clarityProjectId}`}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
