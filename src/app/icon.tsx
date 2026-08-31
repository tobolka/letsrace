import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/**
 * The tab mark: LR, set the way the wordmark is — italic, heavy, race-red.
 * Generated rather than shipped as a file so it stays in step with the logo.
 */
export default function Icon() {
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
          borderRadius: 14,
          color: "#e11d2e",
          fontSize: 34,
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
