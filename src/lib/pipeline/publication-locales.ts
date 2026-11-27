import { StalePublication } from "@/lib/pipeline/publication";
import { fetchPublic } from "@/lib/http/safe-url";
import { locales, type Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";
import { getSiteUrl } from "@/lib/seo";
import { boundedBody } from "@/lib/watcher/http";

export const publicationLocaleWaves = [locales.slice(0, 3), locales.slice(3)];
export const DEFAULT_LOCALE_WAVE_DELAY_MS = 250;

export class RateLimitedPublication extends Error {}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function checkPublicationLocales(
  path: string,
  timeoutMs: number,
  verify: (html: string, status: number, locale: Locale, finalUrl: string) => void,
  waveDelayMs = DEFAULT_LOCALE_WAVE_DELAY_MS,
) {
  for (let index = 0; index < publicationLocaleWaves.length; index++) {
    if (index > 0 && waveDelayMs > 0) await sleep(waveDelayMs);
    const wave = publicationLocaleWaves[index];
    const checks = await Promise.allSettled(wave.map(async locale => {
      try {
        const url = `${getSiteUrl()}${localePath(locale, path)}`;
        const page = await fetchPublic(url, {
          headers: { "User-Agent": "LetsRace-Publication-Check/1.0" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (page.status === 429) {
          await page.body?.cancel().catch(() => {});
          throw new RateLimitedPublication("Public page returned HTTP 429");
        }
        const html = new TextDecoder().decode(await boundedBody(page, 2 * 1024 * 1024));
        if (page.status === 200 && /<html\b[^>]*\blang=["']([^"']+)["']/i.exec(html)?.[1] !== locale) {
          throw Error("Public page returned a different language");
        }
        verify(html, page.status, locale, page.url || url);
      } catch (error) {
        const message = `${locale}: ${error instanceof Error ? error.message : String(error)}`;
        if (error instanceof StalePublication) throw new StalePublication(message);
        if (error instanceof RateLimitedPublication) throw new RateLimitedPublication(message);
        throw Error(message);
      }
    }));
    const rejected = checks.filter((check): check is PromiseRejectedResult => check.status === "rejected");
    const rateLimited = rejected.find(check => check.reason instanceof RateLimitedPublication);
    if (rateLimited) throw rateLimited.reason;
    if (rejected[0]) throw rejected[0].reason;
  }
  return [...locales];
}
