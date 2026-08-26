import { ImageResponse } from "next/og";
import { getPublicEventBySlug } from "@/lib/events";

export const alt = "Let's Race race";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function EventOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getPublicEventBySlug(slug);
  const title = event?.name ?? "Cycling race";
  const place =
    event?.location?.municipality ||
    event?.location?.name ||
    event?.location?.countryCode ||
    "";
  const date = event?.startDate ?? "";

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
            fontSize: 56,
            letterSpacing: "-0.04em",
            fontWeight: 900,
            fontStyle: "italic",
            color: "#c81d25",
            lineHeight: 0.9,
          }}
        >
          Let&apos;s Race
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 980 }}>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.03em" }}>{title}</div>
          <div style={{ fontSize: 26, opacity: 0.75 }}>
            {[date, place].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
