# Decoder and spreadsheet journey

Visual references: `decoder-landing-concept.png`, `decoder-upload-concept.png`,
and `decoder-states-concept.png` (1536 × 1024). These are design artifacts,
not client assets. The existing Next.js components retain state and API ownership.

## Design contract

- True white canvas, ink `#19232c`, emerald `#116344`, muted `#5c6570`,
  sage `#f3f7f5`, border `#dce1e4`. No gradients or raster UI.
- Arial/Helvetica system stack; desktop hero 48px, mobile 34px, section
  headings 28px, body 16px, controls 16px, explanatory notes 13px.
- 1180px shell, 28px desktop gutters, 20px mobile gutters; 48px column gaps;
  8px control corners, thin rules, one framed decoder form.
- Desktop: open heading and three-step rail beside the form; trust strip;
  sage upload band with explanation beside the existing uploader; open guides
  beside FAQ. Mobile: heading, form, journey, upload, guides, FAQ.
- Result state: readable single-column explanation, explicit certainty,
  numbered instructions, approved source links, highlighted optional XLSX CTA.
- Existing check/upload SVG icons remain code-native. No decorative shield
  or certification symbols. Controls use native focus and disabled states.
- Copy above the fold: FeedFix, Guides, Compatibility; original decoder H1
  and subcopy; Walmart error message; original privacy warning, placeholder,
  Explain this error, no-account help; the three journey steps from the concept.
- Trust strip: No Seller Center connection; No payment to see your explanation.

## Intentional corrections to generated references

Generated copy is not product evidence. Omit invented email delivery, anonymous
analytics consent, hamburger navigation and generated diagnostic advice. Retain
the audited knowledge responses, full study consent, privacy warnings, preview
compatibility warning and optional-support terms. The upload reference governs
the lower section, replacing those errors in the overview. Results remain in
reading order rather than splitting dependent instructions across columns.
No new remote fonts, dependencies, APIs or shipped image assets.

## Browser comparison and fidelity ledger

Checked production in Playwright Chromium because Browser/IAB tools were not
available. Used `view_image` to inspect all three references and desktop/mobile
renders. Desktop viewport: 1536 × 1024 (native reference dimensions). Mobile:
390 × 844. Screenshots here are intentional review deliverables, not shipped assets.

| Point | Reference vs. implementation | Resolution |
| --- | --- | --- |
| First task | Large question beside framed form | Preserved; 48px desktop / 34px mobile heading |
| Palette | White canvas, emerald actions, sage upload | Preserved without generated gradient artifacts |
| Journey | Three numbered steps before optional file | Preserved; moved below form on mobile to keep primary action visible |
| Containers | Open introduction, one form panel, separate upload band | Preserved within existing 1180px shell; no new decorative cards |
| Copy | Generated condensed privacy and consent | Restored full audited wording; intentional additional height |
| Icons | Generated shields, lock and upload variants | Kept existing check/upload vectors; removed unsupported trust symbolism |
| Results | Certainty, instructions, source, optional workbook CTA | Preserved in one readable column; no generated diagnostic content |
| Mobile | Stacked, readable controls | No horizontal overflow; submit bottom at 707px in 844px viewport |
| Lower page | Compatibility/guides beside FAQ | Preserved; stacks vertically on mobile |

Above-the-fold copy review: original heading, subcopy, input label, placeholder
and submit CTA are unchanged. The journey wording comes from the reference.
Full privacy/help text is intentionally longer. No invented service claims,
email delivery, new navigation or anonymity promise was introduced.

Functional verification: documented, likely and unknown responses, share/decline,
plain-text XSS handling, focused workbook CTA, existing upload/correction/download,
new-template sharing and SEO routes. No API, knowledge, retention, analytics or
schema boundaries changed in this redesign. No new client dependency or image
payload. Lab LCP comparison was not measured; no production speed claim is made.

## Executed checks

- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm test`: 175 tests, 16 files passed.
- `npm run build`: exit 0; production render verified afterward.
- `npm run test:e2e`: 24 desktop/mobile tests passed, including new first-viewport
  and overflow assertions. Existing assertions were preserved.
- `git diff --check`: exit 0.

Temporary visual QA captures/script removed after retaining the review deliverables.
The pre-existing user development server was not stopped. No commit or push.
