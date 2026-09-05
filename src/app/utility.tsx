"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FeedIssue, FixOperation } from "../engine/model";
type Analysis = {
  id: string;
  status: "ANALYZED" | "PAID";
  expiresAt: number;
  itemCount: number;
  sheetCount: number;
  synthetic: boolean;
  amount: number;
  autoFixCount: number;
  issues: FeedIssue[];
  changes?: FixOperation[];
  generated: boolean;
  feedback?: "YES" | "NO" | "NOT_YET";
};
const labels = {
  AUTO_FIX: "Auto-fix",
  NEEDS_USER_INPUT: "Needs your input",
  WALMART_SUPPORT: "Walmart Support",
  WARNING: "Warning",
};
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n / 100,
  );
function Icon({ upload = false }: { upload?: boolean }) {
  return (
    <svg
      width={upload ? 36 : 26}
      height={upload ? 36 : 26}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {upload ? (
        <>
          <path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
        </>
      ) : (
        <>
          <rect x="2" y="2" width="20" height="20" rx="2" />
          <path d="m6.5 12 3.5 3.5 7.5-7.5" />
        </>
      )}
    </svg>
  );
}
function event(name: string, properties = {}) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: name, properties }),
    keepalive: true,
  }).catch(() => {});
}
export default function FeedFix({
  amount,
  maxUpload,
  demo,
  mock,
}: {
  amount: number;
  maxUpload: number;
  demo: boolean;
  mock: boolean;
}) {
  const [file, setFile] = useState<File | null>(null),
    [report, setReport] = useState<File | null>(null),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false),
    [mockCheckout, setMockCheckout] = useState(false),
    [filter, setFilter] = useState("ALL"),
    [page, setPage] = useState(1),
    [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  async function api(path: string, options: RequestInit = {}) {
    const id =
      analysis?.id ??
      new URLSearchParams(location.search).get("analysis") ??
      new URLSearchParams(location.search).get("mock");
    const token = id ? sessionStorage.getItem("feedfix:" + id) : null;
    const res = await fetch("/api/" + path, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }
    return res;
  }
  useEffect(() => {
    event("landing_view");
    const params = new URLSearchParams(location.search),
      id = params.get("analysis") ?? params.get("mock");
    if (!id) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function refresh() {
      try {
        const token = sessionStorage.getItem("feedfix:" + id);
        if (!token)
          throw new Error(
            "Open this analysis in the browser tab where you uploaded the file.",
          );
        const res = await fetch("/api/analysis/" + id, {
          headers: { Authorization: "Bearer " + token },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (stopped) return;
        setMockCheckout(Boolean(params.get("mock")) && mock);
        if (params.has("cancelled"))
          setNotice(
            "Support payment cancelled. Your downloads are still free.",
          );
        setAnalysis(data);
        if (data.status === "PAID") {
          setNotice(
            "Thank you for supporting FeedFix! Your downloads are always free.",
          );
          return;
        }
        if (
          params.has("support") &&
          !params.has("mock") &&
          !params.has("cancelled") &&
          attempts++ < 40
        ) {
          setNotice(
            "Waiting for payment confirmation. This can take a moment.",
          );
          timer = setTimeout(refresh, 3000);
        } else if (attempts >= 40)
          setNotice(
            "Payment is still being confirmed. Use Refresh payment status below.",
          );
      } catch (e) {
        if (!stopped) setError((e as Error).message);
      }
    }
    void refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [mock]);
  function select(f: File | undefined) {
    if (!f) return;
    setError("");
    if (
      !f.name.toLowerCase().endsWith(".xlsx") ||
      f.size > maxUpload * 1024 * 1024
    ) {
      setError(
        `Choose an XLSX workbook under ${maxUpload} MB. XLSM is not supported.`,
      );
      return;
    }
    setFile(f);
    event("file_selected", {
      file_size_bucket:
        f.size < 1024 * 1024
          ? "small"
          : f.size < 10 * 1024 * 1024
            ? "medium"
            : "large",
    });
  }
  async function analyze() {
    if (!file) {
      setError("Choose your XLSX workbook first.");
      fileInput.current?.focus();
      return;
    }
    setBusy("Analyzing your workbook…");
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      if (report) form.set("report", report);
      const res = await api("analyze", { method: "POST", body: form });
      const data = await res.json();
      sessionStorage.setItem("feedfix:" + data.analysis.id, data.token);
      setAnalysis(data.analysis);
      history.replaceState({}, "", "/?analysis=" + data.analysis.id);
      setTimeout(() => heading.current?.focus(), 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function pay() {
    if (!analysis) return;
    setBusy("Opening secure checkout…");
    setError("");
    try {
      const data = await (
        await api("checkout/" + analysis.id, { method: "POST" })
      ).json();
      location.assign(data.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }
  async function finishMock() {
    if (!analysis) return;
    setBusy("Confirming test payment…");
    try {
      await api("mock-payment/" + analysis.id, { method: "POST" });
      setAnalysis(await (await api("analysis/" + analysis.id)).json());
      setMockCheckout(false);
      setNotice("Test payment confirmed. No money was charged.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function download(report = false) {
    if (!analysis) return;
    setBusy("Preparing your download…");
    setError("");
    try {
      const res = await api(
        "download/" + analysis.id + (report ? "?report=1" : ""),
      );
      const blob = await res.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = report ? "feedfix-changes.json" : "feedfix-corrected.xlsx";
      a.click();
      if (!report)
        setAnalysis(await (await api("analysis/" + analysis.id)).json());
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const filtered =
    analysis?.issues.filter(
      (i) => filter === "ALL" || i.resolution === filter,
    ) ?? [];
  return (
    <>
      <header>
        <Link
          onClick={() => {
            setAnalysis(null);
            setFile(null);
            setReport(null);
            setNotice("");
            setError("");
          }}
          className="brand"
          href="/"
          aria-label="FeedFix home"
        >
          <Icon />
          FeedFix
        </Link>
        <span>No account needed</span>
      </header>
      <main>
        {!analysis ? (
          <>
            <section className="intro">
              <h1>
                Walmart rejected your
                <br className="desktop-break" /> item setup file?
              </h1>
              <p>
                Upload it. We’ll find the errors and fix
                <br className="desktop-break" /> what can be safely corrected.
              </p>
            </section>
            <section className="upload-section" aria-label="Upload workbook">
              <div
                className={"dropzone" + (drag ? " dragging" : "")}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  select(e.dataTransfer.files[0]);
                }}
              >
                <Icon upload />
                <strong>
                  {file ? file.name : "Drop your Walmart file here"}
                </strong>
                <label className="file-label" htmlFor="workbook">
                  {file ? "Choose a different file" : "or choose a file"}
                </label>
                <input
                  ref={fileInput}
                  id="workbook"
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => select(e.target.files?.[0])}
                />
                <small>XLSX · No login · Analysis is free</small>
              </div>
              <details className="report-picker">
                <summary>
                  {report
                    ? "Processing report attached"
                    : "Add a processing report (optional)"}
                </summary>
                <label htmlFor="report">
                  Walmart error report · XLSX or CSV
                </label>
                <input
                  id="report"
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(e) => setReport(e.target.files?.[0] ?? null)}
                />
              </details>
              <button
                className="primary"
                onClick={analyze}
                disabled={Boolean(busy)}
              >
                {busy || "Analyze file — free"}
              </button>
              {demo && (
                <p className="demo-note">
                  Preview: supports FeedFix’s synthetic fixtures only. Official
                  Walmart templates are not yet enabled.
                </p>
              )}
              <p className="price-note">
                Analysis, corrections and downloads are free. Optional support:{" "}
                {money(amount)}.
              </p>
            </section>
            <ol className="steps">
              <li>
                <span>1</span>Upload
              </li>
              <li>
                <span>2</span>Analyze
              </li>
              <li>
                <span>3</span>Fix
              </li>
            </ol>
            <p className="privacy">
              We never connect to your Walmart account.
              <br />
              Files are automatically deleted within one hour.
            </p>
            <section className="faq" aria-label="Frequently asked questions">
              <details>
                <summary>What can FeedFix safely fix?</summary>
                <p>
                  Only deterministic changes authorized by the supported
                  template, such as extra whitespace or enum casing. We never
                  invent GTINs, SKUs or catalog information. Some issues need
                  your input or Walmart Support. Acceptance is not guaranteed.
                </p>
              </details>
              <details>
                <summary>What happens to my file?</summary>
                <p>
                  Your workbook is stored temporarily for analysis and checkout,
                  then automatically deleted within one hour. No AI analysis, no
                  training and no Walmart account connection. Download before
                  the expiry shown in your results.
                </p>
              </details>
              <details>
                <summary>Which files are supported?</summary>
                <p>
                  XLSX up to {maxUpload} MB and 10,000 items.{" "}
                  {demo
                    ? "This preview accepts only the clearly marked synthetic fixtures in the repository."
                    : "Only explicitly supported template versions are accepted."}{" "}
                  Macros, external links and encrypted workbooks are not
                  supported.
                </p>
              </details>
            </section>
          </>
        ) : (
          <section className="results">
            <Link
              className="back"
              href="/"
              onClick={() => {
                setAnalysis(null);
                setFile(null);
                setReport(null);
                setNotice("");
                setError("");
              }}
            >
              Upload another file
            </Link>
            <h1 ref={heading} tabIndex={-1}>
              Analysis complete
            </h1>
            <p className="result-sub">
              {analysis.itemCount} items analyzed · {analysis.issues.length}{" "}
              issues detected
            </p>
            {analysis.synthetic && (
              <p className="demo-note">
                Synthetic fixture · Demonstration only · Not an official Walmart
                template
              </p>
            )}
            <div className="counts">
              {(
                [
                  "AUTO_FIX",
                  "NEEDS_USER_INPUT",
                  "WALMART_SUPPORT",
                  "WARNING",
                ] as const
              ).map((r) => (
                <div key={r}>
                  <strong>
                    {analysis.issues.filter((i) => i.resolution === r).length}
                  </strong>
                  <span>{labels[r]}</span>
                </div>
              ))}
            </div>
            <h2>
              {analysis.issues.length
                ? "Problems found"
                : "No issues found in the supported checks"}
            </h2>
            {!analysis.issues.length && (
              <p>
                No payment needed. These checks do not cover every Walmart
                requirement.
              </p>
            )}
            {analysis.issues.length > 0 && (
              <>
                <label className="filter">
                  Show{" "}
                  <select
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="ALL">All issues</option>
                    {Object.entries(labels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="issues">
                  {filtered.slice(0, page * 30).map((i) => (
                    <article key={i.id}>
                      <div className="issue-location">
                        {i.row ? `Row ${i.row}` : "Unmatched report issue"}
                        {i.column ? " · " + i.column : ""}
                      </div>
                      <div className="issue-heading">
                        <h3>{i.title}</h3>
                        <span className={"badge " + i.resolution.toLowerCase()}>
                          {labels[i.resolution]}
                        </span>
                      </div>
                      <p>{i.description}</p>
                      {i.resolution === "AUTO_FIX" && (
                        <pre>
                          {String(i.originalValue)} → {String(i.proposedValue)}
                        </pre>
                      )}
                    </article>
                  ))}
                </div>
                {filtered.length > page * 30 && (
                  <button
                    className="secondary"
                    onClick={() => setPage(page + 1)}
                  >
                    Show more issues
                  </button>
                )}
              </>
            )}
            <div className="purchase">
              {analysis.autoFixCount > 0 ? (
                <>
                  <h2>
                    {analysis.autoFixCount} issues can be corrected
                    automatically
                  </h2>
                  <p>
                    Download for free. Review the changes and remaining issues
                    before uploading to Walmart.
                  </p>
                  <button
                    className="primary"
                    disabled={Boolean(busy)}
                    onClick={() => download()}
                  >
                    Download corrected XLSX — free
                  </button>
                  <button
                    className="secondary"
                    disabled={Boolean(busy)}
                    onClick={() => download(true)}
                  >
                    Download change report — free
                  </button>
                  {analysis.generated && (
                    <section className="support" aria-label="Optional support">
                      <h2>Did FeedFix help?</h2>
                      <p>
                        Your download is free. If it saved you time, you can
                        support FeedFix.
                      </p>
                      {analysis.status === "PAID" ? (
                        <p role="status">Thank you for your support!</p>
                      ) : mockCheckout && mock ? (
                        <>
                          <p className="demo-note">
                            Local test support payment · No real charge
                          </p>
                          <button
                            className="secondary"
                            disabled={Boolean(busy)}
                            onClick={finishMock}
                          >
                            Simulate optional payment
                          </button>
                        </>
                      ) : (
                        <button
                          className="secondary"
                          disabled={Boolean(busy)}
                          onClick={pay}
                        >
                          Support FeedFix — {money(analysis.amount)} (optional)
                        </button>
                      )}
                      {notice.includes("confirmed") &&
                        analysis.status !== "PAID" && (
                          <button
                            className="text-button"
                            onClick={async () => {
                              try {
                                setAnalysis(
                                  await (
                                    await api("analysis/" + analysis.id)
                                  ).json(),
                                );
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            Refresh payment status
                          </button>
                        )}
                      <fieldset className="feedback">
                        <legend>Did Walmart accept your corrected file?</legend>
                        <p>
                          Optional feedback, reported by you. This is not
                          verified by Walmart.
                        </p>
                        {(
                          [
                            ["YES", "Yes"],
                            ["NO", "No"],
                            ["NOT_YET", "Haven’t tried yet"],
                          ] as const
                        ).map(([outcome, label]) => (
                          <button
                            key={outcome}
                            type="button"
                            className="secondary"
                            aria-pressed={analysis.feedback === outcome}
                            disabled={Boolean(busy)}
                            onClick={async () => {
                              setBusy("Saving your feedback…");
                              setError("");
                              try {
                                setAnalysis(
                                  await (
                                    await api("feedback/" + analysis.id, {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({ outcome }),
                                    })
                                  ).json(),
                                );
                                setNotice("Thank you for your feedback.");
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy("");
                              }
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </fieldset>
                    </section>
                  )}
                </>
              ) : (
                <p>
                  No automatic fixes are available. Use the free diagnosis to
                  make the required changes.
                </p>
              )}
              <small>
                Files and downloads expire at{" "}
                {new Date(analysis.expiresAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                . Keep this tab open.
              </small>
            </div>
          </section>
        )}
        <div aria-live="polite" className="status">
          {busy || notice}
        </div>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
      </main>
      <footer>Independent tool. Not affiliated with Walmart.</footer>
    </>
  );
}
