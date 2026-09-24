import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";
import { seoCopy } from "@/lib/seo";

export const size = { width: 1600, height: 840 };
/**
 * JPEG, not the PNG next/og hands back. The card is mostly a photograph, which
 * is the one thing PNG cannot compress efficiently. Scrapers fetch this on every share and some refuse
 * anything over a megabyte.
 *
 * The bytes are baked under `public/og/` rather than rendered through `sharp`
 * at request time. Sharp's libvips binary is 28 MB and Next was tracing it into
 * every page function — twenty-five of them — which blew Functions Storage past
 * the 10 GB Hobby limit. Serving a static file keeps the JPEG and drops the
 * library from the serverless traces entirely.
 */
export const contentType = "image/jpeg";

export function resolveOgLocale(raw?: string): Locale {
  return locales.includes(raw as Locale) ? (raw as Locale) : defaultLocale;
}

export function homeOgAlt(locale: Locale = defaultLocale): string {
  return seoCopy[locale].title;
}

export const alt = homeOgAlt(defaultLocale);

const ogDir = join(process.cwd(), "public/og");

function homeOgFile(locale: Locale) {
  return join(ogDir, `home-${locale}.jpg`);
}

export default async function HomeOpenGraphImage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
} = {}) {
  const raw = params ? (await params).locale : undefined;
  const locale = resolveOgLocale(raw);
  const jpeg = readFileSync(homeOgFile(locale));

  return new Response(jpeg, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
