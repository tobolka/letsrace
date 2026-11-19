// OpenNext generates this module during the Cloudflare build.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- generated module is absent before the first build
import handler from "./.open-next/worker.js"

type WorkerEnv = {
  CRON_SECRET?: string
  WORKER_SELF_REFERENCE: { fetch(request: Request): Promise<Response> }
}

/** Same schedule and routes the project used on Vercel (see vercel.json). */
const CRON_ROUTES: Record<string, string> = {
  "10 4 * * *": "/api/cron/weather-history",
  "0 4 * * 3": "/api/cron/digest",
  "15 5 * * *": "/api/cron/catalog",
  "30 5 * * *": "/api/cron/public-refresh",
  "40 5 * * *": "/api/cron/publication",
  "45 5 * * *": "/api/cron/alerts",
}

const worker = {
  fetch: handler.fetch,
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
