import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Let's Race — cycling races on the map";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Satori resolves every element against the faces it is given, so registering
 * only the wordmark's black italic set the whole card in italic. Give it the
 * upright faces too and name the family per element.
 */
const fontDir = join(process.cwd(), "src/app/_fonts");
const geistBlackItalic = readFileSync(join(fontDir, "Geist-BlackItalic.ttf"));
const geistBold = readFileSync(join(fontDir, "Geist-Bold.ttf"));
const geistRegular = readFileSync(join(fontDir, "Geist-Regular.ttf"));

/**
 * The share card has to answer "what is this?" in the second before someone
 * scrolls past. A wordmark on flat charcoal reads as any startup; a rider mid-
 * blur through a sunlit forest reads as bike racing before a word is read.
 *
 * Satori has no gradient worth the name, so the photo carries the whole frame
 * and the copy sits on a flat scrim over its left — legible without fighting
 * the picture.
 */
const photo = readFileSync(join(process.cwd(), "public/og-race.jpg"));
const photoSrc = `data:image/jpeg;base64,${photo.toString("base64")}`;


export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#1c1917",
          color: "#fafaf9",
          fontFamily: "Geist",
        }}
      >
        <img
          src={photoSrc}
          alt=""
          width={size.width}
          height={size.height}
          style={{ position: "absolute", left: 0, top: 0, objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 72,
            // Even darkening rather than a panel: a scrim wide enough to hold
            // the headline also swallowed the rider, who is the whole point.
            background: "rgba(18, 16, 14, 0.55)",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 50,
              letterSpacing: "-0.04em",
              fontFamily: "GeistItalic",
              fontWeight: 900,
              fontStyle: "italic",
              color: "#e11d2e",
            }}
          >
            Let&apos;s Race
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, width: 760 }}>
            <div
              style={{
                fontSize: 62,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.035em",
              }}
            >
              Every cycling race, on one map
            </div>
            <div style={{ fontSize: 26, color: "#c9c3bd", lineHeight: 1.35 }}>
              Road · gravel · MTB · cyclocross · kids, across Central Europe.
              Plan the season for yourself, your family or your team.
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: geistRegular, weight: 400, style: "normal" },
        { name: "Geist", data: geistBold, weight: 700, style: "normal" },
        { name: "GeistItalic", data: geistBlackItalic, weight: 900, style: "italic" },
      ],
    },
  );
}
