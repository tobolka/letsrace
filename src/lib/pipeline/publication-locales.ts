import { fetchPublic } from "@/lib/http/safe-url";
import { locales, type Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";
import { getSiteUrl } from "@/lib/seo";
import { boundedBody } from "@/lib/watcher/http";

export const publicationLocaleWaves = [locales.slice(0, 3), locales.slice(3)];

export async function checkPublicationLocales(
  path: string,
  timeoutMs: number,
  verify: (html: string, status: number, locale: Locale) => void,
) {
  for (const wave of publicationLocaleWaves) {
    const checks = await Promise.allSettled(wave.map(async locale => {
      try {
        const page = await fetchPublic(`${getSiteUrl()}${localePath(locale, path)}`, {
          headers: { "User-Agent": "LetsRace-Publication-Check/1.0" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        const html = new TextDecoder().decode(await boundedBody(page, 2 * 1024 * 1024));
        if (page.status === 200 && /<html\b[^>]*\blang=["']([^"']+)["']/i.exec(html)?.[1] !== locale) {
          throw Error("Public page returned a different language");
        }
        verify(html, page.status, locale);
      } catch (error) {
        throw Error(`${locale}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }));
    for (const check of checks) if (check.status === "rejected") throw check.reason;
  }
  return [...locales];
}
