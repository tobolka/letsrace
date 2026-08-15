import { ImageResponse } from "next/og";
import { getPublicEventBySlug } from "@/lib/events";

export const alt = "Startline race";
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
          background: "linear-gradient(145deg, #1c1917 0%, #292524 50%, #0c4a6e 100%)",
          color: "#fafaf9",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            opacity: 0.75,
            fontWeight: 600,
          }}
        >
          Startline
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 980 }}>
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.08 }}>{title}</div>
          <div style={{ fontSize: 28, opacity: 0.85 }}>
            {[date, place].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
