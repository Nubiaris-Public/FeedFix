import {
  classifySource,
  navigationContext,
  publicContext,
  type PublicContext,
} from "../shared/guide-context";
export function browserContext(): PublicContext {
  if (typeof window === "undefined") return { source: "unknown" };
  const params = new URLSearchParams(location.search);
  const { guide } = navigationContext(params);
  const detected = classifySource(location.href, document.referrer);
  return publicContext({
    guide_id: guide?.slug,
    source:
      detected === "paid"
        ? "paid"
        : guide && params.has("source")
          ? params.get("source")
          : detected,
  });
}
export function contextHeaders() {
  return { "x-feedfix-context": JSON.stringify(browserContext()) };
}
export function journeyEvent(
  event: string,
  properties: Record<string, unknown> = {},
) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...contextHeaders() },
    body: JSON.stringify({ event, properties }),
    keepalive: true,
  }).catch(() => {});
}
