# Google SEO launch

Production domain: **https://feedfix.app**. The Railway definition declares this custom domain, `APP_URL=https://feedfix.app` and `SEO_INDEXABLE=true`. Applying infrastructure changes and configuring the DNS records supplied by Railway are still required. Keep separate preview environments non-indexable.

In Search Console, add the Domain property `feedfix.app` and publish Google's supplied DNS TXT verification record. Submit `https://feedfix.app/sitemap.xml` after the updated deployment is reachable. The DNS verification value must come from your Search Console account; it cannot be generated locally.

FeedFix targets English-language searches by Walmart Marketplace sellers: “Walmart item setup errors”, “Walmart bulk upload spreadsheet errors”, and “Walmart GTIN errors”. These are intent hypotheses, not researched traffic estimates. The home page is the single conversion destination; no blog or duplicate keyword landing pages.

## Implemented

- Server-rendered title, description, H1 and visible FAQ about supported checks and limits. Preview metadata explicitly says official templates are not enabled.
- Canonical URL and Open Graph URL derive from `APP_URL`, never from upload tokens, query parameters or request Host headers.
- `/sitemap.xml` lists only the public home when indexing is enabled. Runtime generation allows Railway variables to change without embedding a build-time domain. No invented modification dates.
- `/robots.txt` advertises that sitemap. Crawling remains allowed so Google can see `noindex`; robots.txt is not a privacy mechanism.
- Analysis/payment-return query URLs have `noindex`; API responses use `X-Robots-Tag: noindex, nofollow, nosnippet`. Downloads still require existing authorization.
- `WebSite` JSON-LD supplies the FeedFix site name. No fabricated ratings, reviews or promises of rich search results.
- `GOOGLE_SITE_VERIFICATION` adds the Search Console HTML verification tag.

## Activate on the final domain

1. Deploy to your final HTTPS domain. Set `APP_URL` to that exact origin and redirect alternate hostnames to it at the hosting/domain layer. Canonical tags are a hint, not a redirect.
2. Confirm the real template support and visible claims before inviting sellers. Preview/staging should retain `SEO_INDEXABLE=false`. Set `SEO_INDEXABLE=true` only on the intended public production deployment; HTTPS and production mode are also required.
3. Add the domain property in Google Search Console using DNS verification, or use a URL-prefix property and put the supplied HTML tag's **content value** in `GOOGLE_SITE_VERIFICATION`. DNS verification does not need this variable.
4. Redeploy. Inspect the HTML, canonical and robots meta; open `/robots.txt` and `/sitemap.xml`. Submit the sitemap in Search Console. Use URL Inspection's live test for `/`, then request indexing.
5. After Google collects data, review indexing, queries, impressions, clicks and CTR. Compare qualified organic visits with completed corrections and optional support payments. Search Console setup/submission requires access to your property; it has not been performed by the code changes.

Google may rewrite titles/descriptions and choose another canonical. Neither a sitemap nor this implementation guarantees indexing, ranking or transactions. The next content decision should follow actual search queries and seller problems, not a quota of pages.

References: [Google canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview), [URL Inspection](https://support.google.com/webmasters/answer/9012289).
