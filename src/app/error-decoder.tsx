"use client";
import { useEffect, useRef, useState } from "react";
import type { DecoderResult } from "../shared/error-decoder";
import {
  MAX_ERROR_CHARACTERS,
  normalizeMessage,
  redactMessage,
  UNKNOWN_CONSENT_VERSION,
} from "../decoder/input";
function event(name: string) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: name }),
    keepalive: true,
  }).catch(() => {});
}
async function post(path: string, body: unknown) {
  const response = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Please try again.");
  return data;
}
export default function ErrorDecoder() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<DecoderResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const [consent, setConsent] = useState(false);
  const [shareState, setShareState] = useState<
    "offered" | "declined" | "saved"
  >("offered");
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    event("error_decoder_viewed");
  }, []);
  useEffect(() => {
    if (result) resultHeading.current?.focus();
  }, [result]);
  let finalPreview = "";
  let previewError = "";
  if (preview.trim()) {
    try {
      finalPreview = redactMessage(preview);
    } catch {
      previewError =
        "Shorten the message before sharing; the redacted text must fit within 4,000 characters.";
    }
  }
  let sensitive = false;
  try {
    sensitive = Boolean(
      message && redactMessage(message) !== normalizeMessage(message),
    );
  } catch {
    /* Submit provides the input error. */
  }
  async function explain() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const answer: DecoderResult = await post("error-decoder", { message });
      setResult(answer);
      setConsent(false);
      setShareState("offered");
      setPreview(answer.status === "UNKNOWN" ? redactMessage(message) : "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!consent || busy || !finalPreview) return;
    setBusy(true);
    setError("");
    try {
      await post("error-decoder-share", {
        message: finalPreview,
        consent: true,
        consentVersion: UNKNOWN_CONSENT_VERSION,
      });
      setShareState("saved");
      setPreview("");
      setMessage("");
      setConsent(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={"decoder" + (result ? " has-result" : "")}
      aria-labelledby="decoder-title"
      data-clarity-mask="true"
    >
      <div className="decoder-introduction">
        <h1 id="decoder-title">What error is Walmart showing you?</h1>
        <p>
          Paste the error message from Seller Center or your Walmart Error
          Report.
        </p>
      </div>
      <ol className="decoder-journey" aria-label="How FeedFix works">
        <li>
          <span>1</span>
          <div>
            <strong>Understand the error</strong>
            <p>Get an explanation before sharing a file.</p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>Check your spreadsheet</strong>
            <p>Upload your XLSX only when you’re ready.</p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>Review safe corrections</strong>
            <p>Available for supported templates.</p>
          </div>
        </li>
      </ol>
      {!result ? (
        <form
          className="decoder-form"
          onSubmit={(e) => {
            e.preventDefault();
            void explain();
          }}
          aria-busy={busy}
        >
          <label htmlFor="walmart-error">Walmart error message</label>
          <p id="decoder-privacy" className="decoder-note">
            Don&apos;t paste sensitive information. Remove SKUs, product names,
            emails or merchant-specific data if present.
          </p>
          <textarea
            id="walmart-error"
            ref={input}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_ERROR_CHARACTERS}
            rows={3}
            required
            disabled={busy}
            aria-describedby="decoder-privacy decoder-help"
            autoComplete="off"
            spellCheck={false}
            placeholder="Your file is missing attribute metadata in Footwear tab"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          {sensitive && (
            <p role="status" className="decoder-note">
              This may contain private information. Remove it before submitting.
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Explaining…" : "Explain this error"}
          </button>
          <p id="decoder-help" className="decoder-note">
            No account required. Don&apos;t include SKUs, product names, emails
            or other sensitive information. Ctrl/⌘ + Enter to submit.
          </p>
        </form>
      ) : (
        <div className="decoder-result">
          <h2 ref={resultHeading} tabIndex={-1}>
            {result.status === "UNKNOWN"
              ? "We don't recognize this Walmart error yet."
              : result.title}
          </h2>
          {result.status === "UNKNOWN" ? (
            <>
              <p className="decoder-certainty">
                Unknown — we do not have a reliable explanation for this
                message.
              </p>
              {shareState === "offered" && (
                <div className="decoder-share">
                  <h3>Help us improve FeedFix</h3>
                  <p>
                    Share a redacted error message so we can add support for it.
                    This is optional.
                  </p>
                  <p id="share-privacy" className="decoder-note">
                    Review the text below and remove any product names or
                    merchant details. Automatic redaction can miss identifying
                    information; we cannot guarantee anonymity. Only this
                    reviewed text is sent when you share. Stored privately for
                    up to 7 days, never for ads or AI training.
                  </p>
                  <label htmlFor="decoder-share-preview">
                    Review message to share
                  </label>
                  <textarea
                    id="decoder-share-preview"
                    value={preview}
                    onChange={(e) => {
                      setPreview(e.target.value);
                      setConsent(false);
                    }}
                    maxLength={MAX_ERROR_CHARACTERS}
                    rows={3}
                    aria-describedby="share-privacy"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy}
                  />
                  <p id="final-preview-title">
                    <strong>Text that will be stored</strong>
                  </p>
                  <pre
                    className="decoder-final-preview"
                    aria-labelledby="final-preview-title"
                  >
                    {finalPreview}
                  </pre>
                  {previewError && <p role="alert">{previewError}</p>}
                  <label className="decoder-consent">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      disabled={busy}
                    />{" "}
                    I removed sensitive information and agree to share this
                    final text shown above for review for up to 7 days.
                  </label>
                  <button
                    type="button"
                    className="primary"
                    disabled={!consent || busy || !finalPreview}
                    onClick={() => void share()}
                  >
                    {busy ? "Sharing…" : "Share reviewed message"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      event("error_decoder_unknown_share_declined");
                      setShareState("declined");
                      setPreview("");
                      setMessage("");
                      setConsent(false);
                    }}
                  >
                    Continue without sharing
                  </button>
                </div>
              )}
              {shareState === "saved" && (
                <p role="status">
                  Thanks — your reviewed message was shared. It will be deleted
                  within 7 days.
                </p>
              )}
              {shareState === "declined" && (
                <p role="status">
                  Nothing was shared. You can still check your spreadsheet.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="decoder-certainty">
                {result.status === "DOCUMENTED"
                  ? "Documented explanation — the message identifies a documented error family, not a verified cell diagnosis."
                  : "Likely match — this resembles a known error family. The exact cause is not confirmed."}
              </p>
              <h3>What this means</h3>
              <p>{result.meaning}</p>
              <h3>Why Walmart is rejecting it</h3>
              <ul>
                {result.causes.map((c) => (
                  <li key={c.text}>
                    <strong>
                      {c.certainty === "DOCUMENTED"
                        ? "Documented rule"
                        : "Possible cause"}
                      :
                    </strong>{" "}
                    {c.text}
                  </li>
                ))}
              </ul>
              <h3>How to fix it</h3>
              <ol>
                {result.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <h3>Before uploading again</h3>
              <ul>
                {result.checklist.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <h3>What we&apos;d need the spreadsheet to verify</h3>
              <p>{result.workbookChecks}</p>
              <h3>Source</h3>
              {result.sources.map((s) => (
                <p key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.label}
                    <span className="decoder-note"> (opens in a new tab)</span>
                  </a>
                </p>
              ))}
            </>
          )}
          <div className="decoder-workbook">
            <h3>Want FeedFix to check the spreadsheet?</h3>
            <p>
              Upload the Walmart XLSX to check a supported workbook. If the
              layout is new, we&apos;ll explain the limits and offer optional
              private template sharing.
            </p>
            <a
              className="primary"
              href="#workbook-upload"
              onClick={() => {
                event("error_decoder_workbook_cta");
                document.getElementById("workbook-upload")?.focus();
              }}
            >
              Check my spreadsheet
            </a>
          </div>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              setResult(null);
              setMessage("");
              setPreview("");
              setError("");
              setConsent(false);
              requestAnimationFrame(() => input.current?.focus());
            }}
          >
            Explain another error
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <p className="decoder-note decoder-processing">
        No file, payment or Seller Center connection needed. Text is processed
        by FeedFix, without AI or third-party sharing. No automatic fixes or
        Walmart acceptance guarantee.
      </p>
    </section>
  );
}
