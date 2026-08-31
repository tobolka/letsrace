import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen mark — same LR, sized for iOS and without the rounding iOS adds. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c1917",
          color: "#e11d2e",
          fontSize: 96,
          fontWeight: 900,
          fontStyle: "italic",
          letterSpacing: "-0.06em",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        LR
      </div>
    ),
    { ...size },
  );
}
