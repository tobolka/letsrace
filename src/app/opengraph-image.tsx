import { ImageResponse } from "next/og";

export const alt = "Startline — cycling race finder";
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
          background: "linear-gradient(145deg, #1c1917 0%, #292524 45%, #0c4a6e 100%)",
          color: "#fafaf9",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            opacity: 0.75,
            fontWeight: 600,
          }}
        >
          Startline
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05, maxWidth: 900 }}>
            Find cycling races on the map
          </div>
          <div style={{ fontSize: 28, opacity: 0.8, maxWidth: 820 }}>
            Central Europe · road · gravel · MTB · CX · kids
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
