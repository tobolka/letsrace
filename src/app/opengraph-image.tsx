import { ImageResponse } from "next/og";

export const alt = "Let's Race — cycling races on the map";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share card has to answer "what is this?" in the second before someone
 * scrolls past. The old one was a wordmark and a sentence on flat charcoal,
 * which reads as any startup; this shows the thing itself — a map strewn with
 * races, colour-coded by discipline the way the app colours its pins.
 */
/**
 * Pins live in the right-hand band only. Satori has no real gradient support,
 * so text and map are separated by layout rather than by a fade — anything
 * behind the headline just fights it.
 */
const PINS = [
  { x: 60, y: 84, c: "#22c55e", r: 15 },
  { x: 168, y: 178, c: "#3b82f6", r: 11 },
  { x: 246, y: 62, c: "#f59e0b", r: 13 },
  { x: 96, y: 286, c: "#22c55e", r: 10 },
  { x: 300, y: 232, c: "#e11d2e", r: 20 },
  { x: 178, y: 366, c: "#3b82f6", r: 12 },
  { x: 372, y: 132, c: "#22c55e", r: 14 },
  { x: 60, y: 432, c: "#a855f7", r: 11 },
  { x: 396, y: 320, c: "#f59e0b", r: 13 },
  { x: 288, y: 440, c: "#3b82f6", r: 10 },
  { x: 130, y: 520, c: "#22c55e", r: 16 },
  { x: 388, y: 508, c: "#e11d2e", r: 12 },
  { x: 250, y: 560, c: "#3b82f6", r: 9 },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#1c1917",
          color: "#fafaf9",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: 740,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 72,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 46,
              letterSpacing: "-0.04em",
              fontWeight: 700,
              color: "#e11d2e",
            }}
          >
            Let&apos;s Race
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.035em",
              }}
            >
              Every cycling race, on one map
            </div>
            <div style={{ fontSize: 27, color: "#a8a29e", lineHeight: 1.35 }}>
              Road · gravel · MTB · cyclocross · kids, across Central Europe.
              Plan the season for yourself, your family or your team.
            </div>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            width: 460,
            display: "flex",
            background: "#231f1d",
            borderLeft: "1px solid #332e2b",
          }}
        >
          {PINS.map((p, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: p.x,
                top: p.y,
                width: p.r * 2,
                height: p.r * 2,
                borderRadius: p.r * 2,
                background: p.c,
                display: "flex",
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
