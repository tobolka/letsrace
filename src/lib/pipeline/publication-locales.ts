import { StalePublication } from "@/lib/pipeline/publication";
import { fetchPublic } from "@/lib/http/safe-url";
import { locales, type Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";
import { getSiteUrl } from "@/lib/seo";
import { boundedBody } from "@/lib/watcher/http";

export const publicationLocaleWaves = [locales.slice(0, 3), locales.slice(3)];

export async function checkPublicationLocales(
  path: string,
  timeoutMs: number,
  verify: (html: string, status: number, locale: Locale, finalUrl: string) => void,
) {
  for (const wave of publicationLocaleWaves) {
    const checks = await Promise.allSettled(wave.map(async locale => {
      try {
        const url = `${getSiteUrl()}${localePath(locale, path)}`;
        const page = await fetchPublic(url, {
          headers: { "User-Agent": "LetsRace-Publication-Check/1.0" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        const html = new TextDecoder().decode(await boundedBody(page, 2 * 1024 * 1024));
        if (page.status === 200 && /<html\b[^>]*\blang=["']([^"']+)["']/i.exec(html)?.[1] !== locale) {
          throw Error("Public page returned a different language");
        }
        verify(html, page.status, locale, page.url || url);
      } catch (error) {
        const message = `${locale}: ${error instanceof Error ? error.message : String(error)}`;
        if (error instanceof StalePublication) throw new StalePublication(message);
        throw Error(message);
      }
    }));
    for (const check of checks) if (check.status === "rejected") throw check.reason;
  }
  return [...locales];
}
