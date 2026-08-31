import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/**
 * Satori has no system fonts, so `fontWeight` and `fontStyle` are inert unless
 * a matching face is supplied — the mark rendered in a plain fallback while the
 * header showed heavy italic. Geist ships a real black italic, which is exactly
 * what the wordmark uses, so hand Satori that file rather than asking it to
 * synthesise a slant.
 *
 * Read at module scope: this route is statically generated, so the file is
 * needed at build time only.
 */
const geistBlackItalic = readFileSync(
  join(process.cwd(), "src/app/_fonts/Geist-BlackItalic.ttf"),
);

/** The tab mark: LR, set like the wordmark — black, italic, tightly tracked. */
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
          fontSize: 33,
          fontFamily: "Geist",
          fontWeight: 900,
          fontStyle: "italic",
          letterSpacing: "-0.04em",
          // The glyphs lean right; nudge left so the pair sits optically centred.
          paddingRight: 3,
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
