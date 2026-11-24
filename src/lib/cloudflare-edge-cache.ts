export const MAX_EDGE_SECONDS = 1800;

const TRACKING_PARAM = /^(?:utm_[a-z0-9_]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|srsltid|_gl)$/i;
const QUERYLESS_ROUTE =
  /^\/(?:(?:cs|en|sk|de|pl)\/(?:e|zavod|preteky|rennen|wyscigi|series|serie|seria|about|o-projektu|o-projekte|ueber|o-projekcie|privacy|soukromi|sukromie|datenschutz|prywatnosc|terms|podminky|podmienky|nutzungsbedingungen|regulamin)(?:\/|$)|robots\.txt$|sitemap\.xml$|sitemaps\/)/;

const RSC_HEADERS = [
  "rsc",
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "next-router-state-tree",
  "next-url",
];

export function edgeSeconds(response: Response): number {
  if (response.status !== 200 || response.headers.has("set-cookie")) return 0;
  // Never store Next.js RSC flight payloads under the HTML page's cache key.
  const contentType = response.headers.get("content-type") ?? "";
  if (/text\/x-component/i.test(contentType)) return 0;
  const control = response.headers.get("cdn-cache-control") ?? "";
  if (!/\bpublic\b/i.test(control)) return 0;
  const seconds = Number(/s-maxage=(\d+)/i.exec(control)?.[1] ?? 0);
  return Math.min(seconds, MAX_EDGE_SECONDS);
}

export function cacheKey(request: Request, version = "dev"): Request {
  const url = new URL(request.url);
  let search = "";
  if (url.search && !QUERYLESS_ROUTE.test(url.pathname)) {
    const kept = new URLSearchParams();
    for (const [k, v] of [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (!TRACKING_PARAM.test(k)) kept.append(k, v);
    }
    const qs = kept.toString();
    if (qs) search = `?${qs}`;
  }
  return new Request(`https://edge-cache.invalid/${version}${url.pathname}${search}`);
}

export function cacheable(request: Request): boolean {
  if (request.method !== "GET") return false;
  if (request.headers.has("authorization")) return false;
  // Next.js App Router RSC/prefetch requests share the page URL (and QUERYLESS_ROUTE
  // strips ?_rsc=...), so caching them here would poison HTML page entries with text/x-component.
  for (const header of RSC_HEADERS) {
    if (request.headers.has(header)) return false;
  }
  const url = new URL(request.url);
  if (url.searchParams.has("_rsc")) return false;
  // Markdown, RSC flight and other content negotiation share a URL with the HTML page.
  const accept = request.headers.get("accept") ?? "";
  if (/text\/x-component/i.test(accept)) return false;
  if (/markdown|json|text\/plain/i.test(accept) && !/text\/html/i.test(accept)) return false;
  return true;
}
