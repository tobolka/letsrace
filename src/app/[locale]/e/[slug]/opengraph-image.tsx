import { format, parseISO } from "date-fns";
import { ImageResponse } from "next/og";
import { getPublicEventBySlug } from "@/lib/events";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";
import { eventSeoCopy } from "@/lib/seo";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function resolveLocale(raw?: string): Locale {
  return locales.includes(raw as Locale) ? (raw as Locale) : defaultLocale;
}

export default async function EventOgImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale = resolveLocale(raw);
  const seo = eventSeoCopy[locale];
  const event = await getPublicEventBySlug(slug);
  const title = event?.name ?? seo.fallbackRace;
  const place =
    event?.location?.municipality ||
    event?.location?.name ||
    event?.location?.countryCode ||
    "";
  const date = event?.startDate
    ? format(parseISO(event.startDate), "d MMM yyyy", { locale: dateFnsLocale(locale) })
    : "";

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
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.03em" }}>
            {title}
          </div>
          <div style={{ fontSize: 26, opacity: 0.75 }}>
            {[date, place].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
