"use client";
import { useEffect, useRef, useState } from "react";
import type { UnsupportedUpload } from "../shared/upload-result";
import { NOTIFICATION_CONSENT_VERSION } from "../shared/upload-result";
import {
  CONTRIBUTION_CONSENT_TEXT,
  CONTRIBUTION_CONSENT_VERSION,
  type ContributionReceipt,
} from "../shared/contribution-consent";
type Saved = Extract<ContributionReceipt, { status: "saved" }>;
export default function NewTemplateResult({
  result,
  file,
  receipt,
  copyDeleted,
  onShared,
  onExit,
}: {
  result: UnsupportedUpload;
  file: File | null;
  receipt: Saved | null;
  copyDeleted: boolean;
  onShared: (receipt: Saved) => void;
  onExit: () => void;
}) {
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [email, setEmail] = useState(""),
    [notification, setNotification] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  async function share() {
    if (!file || !consent) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("studyConsent", CONTRIBUTION_CONSENT_VERSION);
      const response = await fetch("/api/study-share", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (
        !response.ok ||
        data.status !== "NEW_WALMART_TEMPLATE" ||
        data.contribution?.status !== "saved"
      )
        throw Error(
          "Your study copy could not be saved. Please try again; sharing is optional.",
        );
      onShared(data.contribution);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function notify() {
    if (!receipt) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/template-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          consentVersion: NOTIFICATION_CONSENT_VERSION,
          studyId: receipt.id,
          deleteToken: receipt.deleteToken,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status !== "SAVED")
        throw Error(
          data.error || "We could not save your notification request.",
        );
      setNotification(true);
      setEmail("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeNotification() {
    if (!receipt) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/notification-delete/" + receipt.id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteToken: receipt.deleteToken }),
      });
      if (!response.ok)
        throw Error("We could not remove this request. Please try again.");
      setNotification(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exit() {
    if (!receipt && result.walmartDetected)
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "template_share_declined" }),
        keepalive: true,
      }).catch(() => {});
    onExit();
  }
  return (
    <section
      className="new-template-result"
      aria-label="Workbook identification result"
    >
      <h1 ref={heading} tabIndex={-1}>
        {result.walmartDetected
          ? "Walmart file detected"
          : "Spreadsheet received"}
      </h1>
      <p>
        {result.walmartDetected
          ? "We found a Walmart spreadsheet layout that FeedFix doesn’t support yet."
          : "We could read this spreadsheet, but there isn’t enough evidence to identify it as a Walmart template."}
      </p>
      <p>Your original file was not modified.</p>
      {result.walmartDetected &&
        result.studyShareAvailable &&
        (receipt ? (
          <>
            <section className="support-note" role="status">
              <h2>Thanks — this template is now under review</h2>
              <p>
                You’ve helped us identify a Walmart template we don’t support
                yet. Sharing does not guarantee support or a delivery date.
              </p>
              {copyDeleted ? (
                <p>Your study copy was deleted.</p>
              ) : (
                <p>
                  The temporary study copy expires within 1 hour. Use “Delete
                  study copy now” below to remove it early.
                </p>
              )}
            </section>
            <section className="notification-request" data-clarity-mask="true">
              <h2>Want to know when this template is supported?</h2>
              {notification ? (
                <>
                  <p role="status">
                    Your notification request is saved. We’ll only use it for
                    support updates about this template. No email has been sent.
                  </p>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={removeNotification}
                  >
                    Remove notification request
                  </button>
                </>
              ) : copyDeleted ? (
                <p>Share a new study copy to request a notification.</p>
              ) : (
                <>
                  <label htmlFor="template-email">Email (optional)</label>
                  <input
                    id="template-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                  />
                  <p>
                    We’ll only use this address to notify you about support for
                    this template. By choosing Notify me, you agree to private
                    storage for up to 30 days. The request expires if support is
                    not added in that time. No account or newsletter.
                  </p>
                  <button
                    className="secondary"
                    onClick={notify}
                    disabled={busy || !email.trim()}
                  >
                    Notify me
                  </button>
                </>
              )}
              <p className="privacy">
                You can leave without providing an email. Keep this tab open to
                remove your notification request early.
              </p>
            </section>
          </>
        ) : (
          <section className="support-note">
            <h2>Help us add support for this template</h2>
            <p>
              Share this workbook privately so we can study its structure and
              add support. The temporary copy is automatically deleted within 1
              hour.
            </p>
            <label className="study-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={busy}
              />
              <span>{CONTRIBUTION_CONSENT_TEXT}</span>
            </label>
            <button
              className="primary"
              onClick={share}
              disabled={busy || !consent}
            >
              {busy ? "Sharing securely…" : "Share securely"}
            </button>
          </section>
        ))}
      {!result.walmartDetected && (
        <p>
          Try an original item setup XLSX exported from Walmart Seller Center.
          We have not applied a mapping or made corrections to this file.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button className="secondary" onClick={exit} disabled={busy}>
        {receipt || !result.walmartDetected
          ? "Check another file"
          : "Continue without sharing"}
      </button>
    </section>
  );
}
