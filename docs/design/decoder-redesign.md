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

## Unified working panel (follow-up)

The current surface supersedes the two separate entry areas above. The hero and
identity remain unchanged. A single right-hand panel offers **Paste an error**
(initial selection) and **Check an Excel file** as native pressed-state buttons.
Both contents stay mounted, hidden when inactive, so the explanation and selected
file survive switching. The existing uploader remains owned by FeedFix and is
passed into ErrorDecoder as a React child; API and matching remain unchanged.
The result CTA switches the panel and focuses the upload region in place.

**Try an example** submits a fixed, non-sensitive sample to the real decoder API;
the resulting guidance is explicitly marked as an example. There is no mocked
answer or client-side classification.

File selection is local until Analyze is pressed. Filename and size are visible,
with Change file and Remove file controls. Removing clears the workbook, related
report and consent. Contribution terms live in a separate optional disclosure;
consent remains explicit, unchecked, and independent of analysis. Upload errors
appear beside the analysis action. Repeated trust strip and separate upload band
were removed. No new illustration, font, dependency or enlarged hero.

Browser QA uses Playwright because Browser/IAB is unavailable. Checked production
at 1536×1024 and 390×844: both entry paths, sample result, selected file controls,
no page exceptions and no horizontal overflow. Review screenshots:
`unified-panel-desktop.png` and `unified-panel-file-mobile.png`.
The new E2E case verifies the real sample response, state preservation, name/size,
removal and zero analyze requests before submission. Test visitors use the
existing trusted-header configuration only in the local Playwright server to
avoid sharing a rate quota across unrelated tests. Production limits are unchanged.

Final follow-up checks: lint and typecheck exited 0; 175 unit/integration tests
passed; production build exited 0; all 26 desktop/mobile E2E tests passed in
55.6s after visitor isolation and a stable rerun. Initial E2E runs exposed shared
rate-quota interference and a development hot reload during editing; neither
failure was hidden by weakening assertions. `git diff --check` is clean.

## Copy and modality refinement

A single instruction above the error field identifies what to remove. The actions
end with `Free explanation · No account required`. Processing, non-retention
without opt-in, no AI/third-party sharing, connection requirements and limitations
remain visible in a labelled 14px block inside the error surface. The detached
paragraph and duplicate sensitive-information warning are removed; contextual
sensitive-input detection remains functional.

Excel mode changes the hero to `Check your Walmart Excel file` and its three
steps to file selection, deliberate analysis, and review of findings. It explicitly
says no error message is needed. Switching back restores the error context.
The real example result retains its label, focused problem title, certainty,
instructions, official sources and optional continuation. Six spaced, ruled
answer sections improve scanning without changing knowledge content.

Refinement QA: production screenshots inspected with `view_image` at desktop
1536×1024 and mobile 390×844. No page errors or horizontal overflow; processing
text computed at 14px. Captures: `refined-error-panel.png`,
`refined-excel-context.png`, `refined-example-mobile.png`. Lint/typecheck/build
passed; 175 unit/integration tests passed; full Playwright suite: 26 passed
(58.2s). No knowledge, API, retention or analytics changes in this refinement.
