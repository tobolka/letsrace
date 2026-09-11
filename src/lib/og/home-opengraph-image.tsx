import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";
import { seoCopy } from "@/lib/seo";

export const size = { width: 1200, height: 630 };
/**
 * JPEG, not the PNG next/og hands back. The card is mostly a photograph, which
 * is the one thing PNG cannot compress: the same image was 1.2 MB as PNG and is
 * a tenth of that as JPEG. Scrapers fetch this on every share and some refuse
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
      // The card only changes when the copy does, and scrapers re-fetch often.
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}
