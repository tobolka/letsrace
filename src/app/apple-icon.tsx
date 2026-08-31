import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const geistBlackItalic = readFileSync(
  join(process.cwd(), "src/app/_fonts/Geist-BlackItalic.ttf"),
);

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
          background: "#ffffff",
          color: "#e11d2e",
          fontSize: 92,
          fontFamily: "Geist",
          fontWeight: 900,
          fontStyle: "italic",
          letterSpacing: "-0.04em",
          paddingRight: 8,
        }}
      >
        LR
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Geist", data: geistBlackItalic, weight: 900, style: "italic" }],
    },
  );
}
