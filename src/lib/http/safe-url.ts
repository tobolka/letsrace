import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** The address was refused before any request was made. */
export class UnsafeUrlError extends Error {
  constructor(reason: string) {
    super(`Refusing to fetch: ${reason}`);
    this.name = "UnsafeUrlError";
  }
}

/** Expand an IPv6 address to its eight 16-bit groups. */
function ipv6Groups(ip: string): number[] {
  const [head, tail = ""] = ip.split("::");
  const parse = (part: string) => (part ? part.split(":") : []);
  const left = parse(head);
  const right = parse(tail);
  // A trailing dotted quad (::ffff:127.0.0.1) is two groups.
  const dotted = (groups: string[]) =>
    groups.flatMap((g) => {
      if (!g.includes(".")) return [g];
      const [a, b, c, d] = g.split(".").map(Number);
      return [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)];
    });
  const l = dotted(left);
  const r = dotted(right);
  const fill = ip.includes("::") ? Array(8 - l.length - r.length).fill("0") : [];
  return [...l, ...fill, ...r].map((g) => parseInt(g, 16));
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

function isPrivateIPv6(ip: string): boolean {
  const g = ipv6Groups(ip.toLowerCase());
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  if ((g[0] & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  // IPv4-mapped (::ffff:a.b.c.d) is judged as the IPv4 address it carries.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return isPrivateIPv4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  return false;
}

/** Is this literal address one that only the machine's own network can reach? */
export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return false;
}

const INTERNAL_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa"];

/** Checks that need no network: scheme, port, credentials, and the host's own name. */
export function checkPublicUrl(raw: string | URL): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("not a URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`${url.protocol} is not http(s)`);
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new UnsafeUrlError(`port ${url.port}`);
  }
  if (url.username || url.password) throw new UnsafeUrlError("credentials in the address");

  // WHATWG parsing has already turned 2130706433 and 0x7f.1 into 127.0.0.1.
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const bareName = !host.includes(".") && !isIP(host);
  if (host === "localhost" || bareName || INTERNAL_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError("internal host name");
  }
  if (isPrivateAddress(host)) throw new UnsafeUrlError("private address");
  return url;
}

/**
 * The address of a page we are about to read, or a refusal.
 *
 * Sources arrive from admins and from visitors' suggestions, and the pages
 * they point to name further links of their own, so a request must not be
 * able to reach the machine's own network (loopback, a cloud metadata
 * address, an office router). The name is resolved here and every address it
 * maps to must be public. This does not stop a name that changes its answer
 * between this check and the request (DNS rebinding); it is a second lock, not
 * the only one.
 */
export async function assertPublicHttpUrl(raw: string | URL): Promise<URL> {
  const url = checkPublicUrl(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return url;
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    // Not resolvable is the ordinary failure; let the request report it.
    return url;
  }
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError("host resolves to a private address");
  }
  return url;
}

const MAX_REDIRECTS = 5;

/**
 * `fetch` that follows redirects itself, so that every hop is checked.
 *
 * With `redirect: "follow"` a public page can answer 302 to
 * `http://169.254.169.254/` and the runtime goes there without asking. The
 * rules are the browser's: 301/302/303 turn the request into a GET without a
 * body, 307/308 repeat it as it was.
 */
export async function fetchPublic(raw: string, init: RequestInit = {}): Promise<Response> {
  let url = await assertPublicHttpUrl(raw);
  let method = init.method ?? "GET";
  let body = init.body;
  for (let hop = 0; ; hop++) {
    const res = await fetch(url, { ...init, method, body, redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || res.status === 304 || !location) return res;
    if (hop >= MAX_REDIRECTS) throw new Error("too many redirects");
    // The body of a redirect is never read; free the connection.
    void res.body?.cancel().catch(() => undefined);
    url = await assertPublicHttpUrl(new URL(location, url));
    if (res.status !== 307 && res.status !== 308) {
      method = "GET";
      body = undefined;
    }
  }
}
