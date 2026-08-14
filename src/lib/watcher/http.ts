import { createHash } from "crypto";
import { hostnameOf, hostIntervalMs, sleep, withHostGate } from "@/lib/watcher/pool";

export const BOT_UA =
  "StartlineBot/0.2 (+https://startline.app; race calendar aggregator; polite)";

/** Hosts whose WAF rejects the bot UA. */
const BROWSER_UA_HOSTS = new Set(["detskatour.sk"]);
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type FetchResult = {
  html: string;
  status: number;
  etag?: string | null;
  lastModified?: string | null;
  hash: string;
  unchanged: boolean;
};

type FetchOpts = {
  etag?: string | null;
  lastModified?: string | null;
  contentHash?: string | null;
  timeoutMs?: number;
  accept?: string;
  /** Skip host gate (e.g. already gated by caller). */
  skipGate?: boolean;
  retries?: number;
};

async function rawFetch(url: string, opts: FetchOpts): Promise<FetchResult> {
  const host = hostnameOf(url);
  const browser = BROWSER_UA_HOSTS.has(host);
  const headers: Record<string, string> = {
    "User-Agent": browser ? BROWSER_UA : BOT_UA,
    Accept: opts.accept ?? "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  };
  if (browser) headers["Accept-Language"] = "sk-SK,sk;q=0.9,en;q=0.8";
  if (opts.etag) headers["If-None-Match"] = opts.etag;
  if (opts.lastModified) headers["If-Modified-Since"] = opts.lastModified;

  const res = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
  });

  if (res.status === 304) {
    return {
      html: "",
      status: 304,
      etag: opts.etag,
      lastModified: opts.lastModified,
      hash: opts.contentHash ?? "",
      unchanged: true,
    };
  }

  const html = await res.text();
  const hash = createHash("sha256").update(html).digest("hex");
  return {
    html,
    status: res.status,
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
    hash,
    unchanged: Boolean(opts.contentHash && opts.contentHash === hash),
  };
}

const CURL_TLS_FALLBACK_HOSTS = new Set(["zapadoceskaamaterskaliga.cz"]);
const CURL_FETCH_FALLBACK_HOSTS = new Set([
  "transmaurienne-vanoise.com",
  "haervejsloebet.dk",
]);

function isTlsVerifyError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.message} ${err.cause ?? ""}` : String(err);
  return /UNABLE_TO_VERIFY|unable to verify the first certificate|CERT_/i.test(msg);
}

async function fetchViaCurl(url: string, insecure = false): Promise<FetchResult> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const args = ["-sL", "-A", BOT_UA, "--max-time", "25"];
  if (insecure) args.push("-k");
  args.push(url);
  const { stdout } = await execFileAsync("curl", args, {
    maxBuffer: 6_000_000,
    encoding: "utf8",
  });
  const html = stdout;
  const hash = createHash("sha256").update(html).digest("hex");
  return {
    html,
    status: html.length > 200 ? 200 : 0,
    hash,
    unchanged: false,
  };
}

function retryable(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * Polite fetch with per-host gating, retries, and Retry-After / exponential backoff.
 */
export async function fetchPage(url: string, opts: FetchOpts = {}): Promise<FetchResult> {
  const host = hostnameOf(url);
  const retries = opts.retries ?? 3;
  const interval = hostIntervalMs(host);

  const run = async (): Promise<FetchResult> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await rawFetch(url, opts);
        if (result.status === 304 || result.status < 400 || !retryable(result.status)) {
          return result;
        }
        lastErr = new Error(`HTTP ${result.status}`);
        if (attempt === retries) return result;

        const retryAfter = Number(
          // rawFetch doesn't expose headers on error path for 429 body responses —
          // use exponential backoff with jitter
          0,
        );
        const backoff =
          retryAfter > 0
            ? retryAfter * 1000
            : Math.min(12_000, 400 * 2 ** attempt) + Math.floor(Math.random() * 250);
        await sleep(backoff);
      } catch (e) {
        lastErr = e;
        if (
          (isTlsVerifyError(e) && CURL_TLS_FALLBACK_HOSTS.has(host)) ||
          CURL_FETCH_FALLBACK_HOSTS.has(host)
        ) {
          try {
            return await fetchViaCurl(url, CURL_FETCH_FALLBACK_HOSTS.has(host));
          } catch {
            /* fall through to retry/throw */
          }
        }
        if (attempt === retries) throw e;
        await sleep(Math.min(12_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 300));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
  };

  if (opts.skipGate) return run();
  return withHostGate(host, interval, run);
}

/** Convenience for JSON APIs used by extractors. */
export async function fetchText(
  url: string,
  opts?: { timeoutMs?: number; accept?: string },
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetchPage(url, {
    timeoutMs: opts?.timeoutMs ?? 20_000,
    accept: opts?.accept,
    retries: 2,
  });
  return { ok: res.status > 0 && res.status < 400, status: res.status, text: res.html };
}
