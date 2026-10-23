/** Who we say we are when we read a page. One name, so a site owner can find and allow it. */
export const BOT_UA =
  "LetsRaceBot/0.2 (+https://letsrace.cz; race calendar aggregator; polite)";

/** Hosts whose WAF rejects the bot UA. */
const BROWSER_UA_HOSTS = new Set(["detskatour.sk", "jesenickysnek.cz", "woodbikerallyseries.cz"]);
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Does this host only answer to a browser's name? */
export function needsBrowserUa(url: string): boolean {
  return BROWSER_UA_HOSTS.has(hostOf(url));
}

/** Use the same known-host compatibility for HTML pages and document downloads. */
export function catalogUserAgent(url: string): string {
  return needsBrowserUa(url) ? BROWSER_UA : BOT_UA;
}
