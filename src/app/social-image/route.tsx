import { ImageResponse } from "next/og";
export const dynamic = "force-static";
export function GET() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#f8faf9",
        padding: 80,
        color: "#19232c",
        borderBottom: "20px solid #116344",
      }}
    >
      <div
        style={{
          display: "flex",
          color: "#116344",
          fontSize: 36,
          marginBottom: 56,
        }}
      >
        FeedFix
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 66,
          fontWeight: 700,
          maxWidth: 980,
        }}
      >
        Walmart item setup errors explained.
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 28,
          marginTop: 36,
          color: "#5c6570",
        }}
      >
        Free explanations · Official references · No file required
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
