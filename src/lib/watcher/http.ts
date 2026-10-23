import { createHash } from "crypto";
import { assertPublicHttpUrl, fetchPublic, UnsafeUrlError } from "@/lib/http/safe-url";
import { BOT_UA, catalogUserAgent, needsBrowserUa } from "@/lib/http/user-agent";
import { hostnameOf, hostIntervalMs, sleep, withHostGate } from "@/lib/watcher/pool";

export { BOT_UA, catalogUserAgent };

export type FetchResult = {
  html: string;
  status: number;
  etag?: string | null;
  lastModified?: string | null;
  hash: string;
  unchanged: boolean;
  contentType?: string | null;
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
  /** For the handful of calendars that answer only to a POST. */
  method?: "GET" | "POST";
  body?: string;
  contentType?: string;
};

async function rawFetch(url: string, opts: FetchOpts): Promise<FetchResult> {
  const browser = needsBrowserUa(url);
  const headers: Record<string, string> = {
    "User-Agent": catalogUserAgent(url),
    Accept: opts.accept ?? "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  };
  if (browser) headers["Accept-Language"] = "sk-SK,sk;q=0.9,en;q=0.8";
  if (opts.etag) headers["If-None-Match"] = opts.etag;
  if (opts.lastModified) headers["If-Modified-Since"] = opts.lastModified;
  if (opts.contentType) headers["Content-Type"] = opts.contentType;

  const res = await fetchPublic(url, {
    headers,
    method: opts.method ?? "GET",
    ...(opts.body != null ? { body: opts.body } : {}),
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

  const bytes = await boundedBody(res);
  const contentType = res.headers.get("content-type");
  const pdf = /pdf/i.test(contentType ?? "") || Buffer.from(bytes.subarray(0, 4)).toString() === "%PDF";
  let html: string;
  if (pdf && res.ok) {
    const { pdfText } = await import("@/lib/catalog/regulation-ages");
    const text = await pdfText(bytes);
    if (!text.trim()) throw new Error("pdf_has_no_text: OCR or manual review required");
    html = `<html><body><pre>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`;
  } else html = decodeBody(bytes, contentType);
  const hash = createHash("sha256").update(html).digest("hex");
  return {
    html,
    status: res.status,
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
    hash,
    unchanged: Boolean(opts.contentHash && opts.contentHash === hash),
    contentType,
  };
}

/** Bound streamed bodies too: Content-Length is optional and not trustworthy. */
export async function boundedBody(res: Response, limit = 8 * 1024 * 1024): Promise<Uint8Array> {
  if (Number(res.headers.get("content-length")) > limit) {
    await res.body?.cancel();
    throw new Error("source_document_too_large");
  }
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("source_document_too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

/**
 * Bytes to text in the page's own charset.
 *
 * `Response.text()` is always UTF-8. A Czech shop on Windows-1250 says so in its
 * header and its `<meta>`, and read as UTF-8 its "Š" (0x8A) is not a character
 * at all: "CYKLOŠVEC s.r.o." came through as "CYKLO\uFFFDVEC s.r.o." — and the
 * replacement character also got it past `isSiteIdentityName`, which could no
 * longer see the shop's own domain in its title, so it was listed as a race
 * again every few days.
 *
 * Bytes that are valid UTF-8 are read as UTF-8 whatever the page claims: plenty
 * of servers still send a stock "charset=iso-8859-1" in front of UTF-8 pages,
 * which `text()` used to get right by accident, and non-ASCII text in a single-
 * byte charset is almost never valid UTF-8 by chance. Otherwise the header
 * wins, then a `<meta>` in the first few KB. A label the runtime does not know
 * falls back to UTF-8 rather than throwing.
 */
export function decodeBody(bytes: Uint8Array, contentType?: string | null): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    /* not UTF-8 — use the charset the page declares */
  }
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  const labels = [
    contentType?.match(/charset\s*=\s*["']?([\w.:-]+)/i)?.[1],
    head.match(/<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i)?.[1],
    head.match(/^<\?xml[^>]+encoding\s*=\s*["']([\w.:-]+)/i)?.[1],
  ];
  for (const label of labels) {
    if (!label) continue;
    try {
      const decoder = new TextDecoder(label.trim());
      // Already shown not to be UTF-8, so a UTF-8 label is the one that is wrong.
      if (decoder.encoding === "utf-8") continue;
      return decoder.decode(bytes);
    } catch {
      /* unknown label — try the next one */
    }
  }
  return new TextDecoder("utf-8").decode(bytes);
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
  // curl follows redirects on its own, so only the address we hand it can be vetted.
  await assertPublicHttpUrl(url);
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
 * Polite fetch with per-host gating, retries, and exponential backoff.
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

        // rawFetch doesn't surface response headers, so we can't honour
        // Retry-After here — exponential backoff with jitter instead.
        const backoff =
          Math.min(12_000, 400 * 2 ** attempt) + Math.floor(Math.random() * 250);
        await sleep(backoff);
      } catch (e) {
        // A refused address is the same answer every time; do not retry it.
        if (e instanceof UnsafeUrlError) throw e;
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
  opts?: {
    timeoutMs?: number;
    accept?: string;
    method?: "GET" | "POST";
    body?: string;
    contentType?: string;
  },
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetchPage(url, {
    timeoutMs: opts?.timeoutMs ?? 20_000,
    accept: opts?.accept,
    method: opts?.method,
    body: opts?.body,
    contentType: opts?.contentType,
    retries: 2,
  });
  return { ok: res.status > 0 && res.status < 400, status: res.status, text: res.html };
}
