import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Quoted — AI-ready WordPress in 30 seconds";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background:
            "linear-gradient(135deg, #ffffff 0%, #ffffff 50%, #eef0fb 100%)",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        {/* Logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="56" height="56" viewBox="0 0 32 32">
            <rect x="0" y="0" width="32" height="32" rx="7" fill="#3b3fbf" />
            <circle cx="15" cy="15" r="7.5" fill="none" stroke="#fff" strokeWidth="2.4" />
            <path
              d="M19.2 18.4 c0.9 0.9 1.2 2.1 0.9 3.3 c-0.3 1.2 -1.1 2 -2.3 2.6"
              fill="none"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <circle cx="20.2" cy="19.4" r="1.6" fill="#3b3fbf" />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 36,
              fontWeight: 600,
              color: "#15151b",
              letterSpacing: "-0.015em",
            }}
          >
            Quoted
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            marginTop: 56,
            fontSize: 76,
            fontWeight: 700,
            color: "#15151b",
            letterSpacing: "-0.028em",
            lineHeight: 1.05,
            maxWidth: 940,
          }}
        >
          <span style={{ display: "flex" }}>AI-ready WordPress in&nbsp;</span>
          <span style={{ display: "flex", color: "#3b3fbf" }}>30 seconds.</span>
        </div>

        {/* Subhead */}
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 26,
            color: "#5b6678",
            maxWidth: 880,
            lineHeight: 1.4,
          }}
        >
          The WordPress plugin that makes your content readable by ChatGPT, Claude, Perplexity, and Google AI.
        </div>

        {/* Footer pill */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            gap: 14,
            alignItems: "center",
            fontSize: 20,
            color: "#5b6678",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "6px 14px",
              background: "#eef0fb",
              color: "#1b1e6b",
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            Free forever tier
          </div>
          <div style={{ display: "flex" }}>· quotedeasy.com</div>
        </div>
      </div>
    ),
    size
  );
}
