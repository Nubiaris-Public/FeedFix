import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  distDir: process.env.FEEDFIX_E2E === "true" ? ".next-e2e" : ".next",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["adm-zip"],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, nosnippet" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://*.clarity.ms${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.clarity.ms https://c.bing.com; connect-src 'self' https://cloudflareinsights.com https://*.clarity.ms https://c.bing.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com`,
          },
        ],
      },
    ];
  },
};
export default config;
