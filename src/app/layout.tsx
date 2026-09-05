import Script from "next/script";
import "./globals.css";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clarityProjectId = process.env.CLARITY_PROJECT_ID?.trim();
  const gaMeasurementId = process.env.GA_MEASUREMENT_ID?.trim();

  return (
    <html lang="en">
      <body>
        {children}
        {gaMeasurementId && /^G-[A-Z0-9]+$/.test(gaMeasurementId) && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaMeasurementId}');`}
            </Script>
          </>
        )}
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
