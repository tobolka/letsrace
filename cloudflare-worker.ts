// OpenNext generates this module during the Cloudflare build.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- generated module is absent before the first build
import handler from "./.open-next/worker.js"
import { cacheable, cacheKey, edgeSeconds } from "./src/lib/cloudflare-edge-cache"

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
  "0 6 * * *": "/api/cron/owner-mail",
}

const worker = {
  async fetch(request: Request, env: WorkerEnv, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    if (!cacheable(request)) return handler.fetch(request, env, ctx)
    const edge = (caches as unknown as { default: EdgeCache }).default
    const key = cacheKey(request, env.CF_VERSION_METADATA?.id ?? "dev")
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
