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
gtag('config', '${gaMeasurementId}', {allow_google_signals: false, allow_ad_personalization_signals: false});`}
            </Script>
          </>
        )}
        {clarityProjectId && /^[a-z0-9]+$/i.test(clarityProjectId) && (
          <Script id="microsoft-clarity" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window,document,"clarity","script","${clarityProjectId}");`}
          </Script>
        )}
      </body>
    </html>
  );
}
