/**
 * Serper.dev Google Search API: real Google results (titles, snippets, PDFs,
 * regional `gl`/`hl` targeting) with 2,500 free queries and no card required.
 * Excludes social hosts the pipeline never reads so free quota goes to real
 * race, club and timing websites.
 */

import type { BraveHit } from "./brave";

export type SerperHit = BraveHit;

export function serperAvailable(): boolean {
  return Boolean(process.env.SERPER_API_KEY);
}

export class SerperUnavailable extends Error {}

const COUNTRY_HL: Record<string, string> = {
  cz: "cs",
  sk: "sk",
  pl: "pl",
  de: "de",
  at: "de",
  ch: "de",
  it: "it",
};

const SOCIAL_EXCLUSION = "-site:facebook.com -site:instagram.com -site:youtube.com -site:tiktok.com";

let searches = 0;
let last = 0;
let queue: Promise<void> = Promise.resolve();

async function searchSlot(): Promise<void> {
  const slot = queue.then(async () => {
    const wait = last + 350 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
  });
  queue = slot.catch(() => {});
  await slot;
}

export function resetSerperProcessCounter() {
  searches = 0;
}

export async function serperSearch(
  query: string,
  opts?: { count?: number; country?: string | null; excludeSocial?: boolean },
): Promise<SerperHit[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new SerperUnavailable("SERPER_API_KEY is not set");
  await searchSlot();
  const limit = Number(process.env.SERPER_SEARCH_LIMIT ?? 15);
  if (!Number.isFinite(limit) || limit <= 0 || searches >= limit) {
    throw new SerperUnavailable(`Serper search limit of ${limit} for this process reached`);
  }
  searches += 1;
  const gl = opts?.country?.toLowerCase();
  const q = opts?.excludeSocial === false || query.includes("-site:facebook.com")
    ? query
    : `${query} ${SOCIAL_EXCLUSION}`;
  const payload: Record<string, unknown> = {
    q,
    num: Math.min(20, Math.max(1, opts?.count ?? 10)),
  };
  if (gl && /^[a-z]{2}$/.test(gl)) {
    payload.gl = gl;
    if (COUNTRY_HL[gl]) payload.hl = COUNTRY_HL[gl];
  }
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 400 || res.status === 402 || res.status === 403 || res.status === 429) {
    throw new SerperUnavailable(`Serper HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`Serper HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as {
    organic?: { link?: string; title?: string; snippet?: string }[];
  };
  return (body.organic ?? [])
    .filter((r): r is { link: string; title?: string; snippet?: string } => Boolean(r.link))
    .map((r) => ({
      url: r.link,
      title: (r.title ?? "").trim(),
      description: (r.snippet ?? "").trim(),
    }));
}
