// OpenNext generates this module during the Cloudflare build.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- generated module is absent before the first build
import handler from "./.open-next/worker.js"

type WorkerEnv = {
  CRON_SECRET?: string
  WORKER_SELF_REFERENCE: { fetch(request: Request): Promise<Response> }
  CF_VERSION_METADATA?: { id: string }
}

type EdgeCache = {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

/** Cron schedule and routes (the daily jobs of the pipeline; see wrangler.jsonc triggers). */
const CRON_ROUTES: Record<string, string> = {
  "10 4 * * *": "/api/cron/weather-history",
  "0 4 * * 3": "/api/cron/digest",
  "15 5 * * *": "/api/cron/catalog",
  "30 5 * * *": "/api/cron/public-refresh",
  "40 5 * * *": "/api/cron/publication",
  "45 5 * * *": "/api/cron/alerts",
}

/**
 * Shared pages and public API answers are the same for every visitor and are marked
 * `CDN-Cache-Control: public, s-maxage=N` by the app (src/proxy.ts, src/app/api). Workers
 * do not sit behind Cloudflare's cache, so hold those answers in the Workers cache: a
 * repeat visit or crawler pass then costs no CPU. The lifetime is capped because there is
 * no tag-based purge here, and the cache key carries the deployment id, so every deploy
 * starts with an empty cache (stale HTML would point at files that no longer exist).
 */
const MAX_EDGE_SECONDS = 1800

function edgeSeconds(response: Response): number {
  if (response.status !== 200 || response.headers.has("set-cookie")) return 0
  const control = response.headers.get("cdn-cache-control") ?? ""
  if (!/\bpublic\b/i.test(control)) return 0
  const seconds = Number(/s-maxage=(\d+)/i.exec(control)?.[1] ?? 0)
  return Math.min(seconds, MAX_EDGE_SECONDS)
}

function cacheKey(request: Request, env: WorkerEnv): Request {
  const url = new URL(request.url)
  const version = env.CF_VERSION_METADATA?.id ?? "dev"
  return new Request(`https://edge-cache.invalid/${version}${url.pathname}${url.search}`)
}

function cacheable(request: Request): boolean {
  if (request.method !== "GET") return false
  // Markdown and other content negotiation share a URL with the HTML page.
  const accept = request.headers.get("accept") ?? ""
  if (/markdown|json|text\/plain/i.test(accept) && !/text\/html/i.test(accept)) return false
  return !request.headers.has("authorization")
}

const worker = {
  async fetch(request: Request, env: WorkerEnv, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    if (!cacheable(request)) return handler.fetch(request, env, ctx)
    const edge = (caches as unknown as { default: EdgeCache }).default
    const key = cacheKey(request, env)
    const hit = await edge.match(key)
    if (hit) {
      const response = new Response(hit.body, hit)
      response.headers.set("x-edge-cache", "HIT")
      return response
    }
    const response: Response = await handler.fetch(request, env, ctx)
    const seconds = edgeSeconds(response)
    if (seconds > 0) {
      const stored = new Response(response.clone().body, response)
      stored.headers.set("Cache-Control", `public, max-age=${seconds}`)
      ctx.waitUntil(edge.put(key, stored))
    }
    return response
  },
  async scheduled(event: { cron: string }, env: WorkerEnv) {
    const path = CRON_ROUTES[event.cron]
    if (!path) throw new Error(`Unknown cron schedule: ${event.cron}`)
    if (!env.CRON_SECRET) throw new Error("CRON_SECRET is not set")
    const response = await env.WORKER_SELF_REFERENCE.fetch(
      new Request(`https://letsrace.internal${path}`, {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      })
    )
    if (!response.ok) throw new Error(`${path} failed (HTTP ${response.status})`)
  },
}

export default worker
