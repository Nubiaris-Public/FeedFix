"use client";
import { useEffect, useRef } from "react";
import { journeyEvent, browserContext } from "../client/journey";
import { toolHref, type GuideId } from "../shared/guide-context";
export default function GuideActions({ id }: { id: GuideId }) {
  const viewed = useRef(false);
  useEffect(() => {
    if (!viewed.current) {
      viewed.current = true;
      journeyEvent("guide_viewed", { guide_id: id });
    }
  }, [id]);
  return (
    <aside className="support-note" aria-label="Try FeedFix">
      <h2>Put this explanation to work</h2>
      <p>
        Read the guidance without sharing a file. These actions open the tool in
        a new tab so an existing message or selected file stays untouched.
      </p>
      <ul>
        {(
          [
            ["example", "Try a related example"],
            ["error", "Explain another error"],
            ["file", "Continue to the file checker"],
          ] as const
        ).map(([action, title]) => (
          <li key={action}>
            <a
              href={toolHref(id, action)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.currentTarget.href =
                  toolHref(id, action) + "&source=" + browserContext().source;
                journeyEvent("guide_tool_clicked", { guide_id: id, action });
              }}
            >
              {title} (new tab)
            </a>
          </li>
        ))}
      </ul>
      <p>
        <a href="/supported-templates">Review template compatibility first</a>.
        Opening the tool does not send a message or upload a file. Start the
        example explicitly in the tool.
      </p>
    </aside>
  );
}
