import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format, parseISO } from "date-fns";
import { ImageResponse } from "next/og";
import { getPublicEventBySlug } from "@/lib/events";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";
import { eventSeoCopy } from "@/lib/seo";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const wordmark = `data:image/svg+xml;base64,${readFileSync(
  join(process.cwd(), "public/brand/lets-race.svg"),
).toString("base64")}`;

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
        {/* The supplied path wordmark renders identically on every server. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wordmark} alt="Let's Race" width={398} height={60} />
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
