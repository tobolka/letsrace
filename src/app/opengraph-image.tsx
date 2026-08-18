import { ImageResponse } from "next/og";

export const alt = "RACEGRID — cycling races on the map";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#1c1917",
          color: "#fafaf9",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 72,
            letterSpacing: "-0.08em",
            fontWeight: 900,
            fontStyle: "italic",
            color: "#c81d25",
            lineHeight: 0.9,
          }}
        >
          RACEGRID
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.05, maxWidth: 920, letterSpacing: "-0.03em" }}>
            Find cycling races on the map
          </div>
          <div style={{ fontSize: 26, opacity: 0.7, maxWidth: 820 }}>
            Central Europe · road · gravel · MTB · CX · kids
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
