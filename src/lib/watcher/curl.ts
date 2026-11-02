import { execFile } from "node:child_process";
import { lookup } from "node:dns/promises";
import { promisify } from "node:util";
import { assertPublicHttpUrl, isPrivateAddress, UnsafeUrlError } from "@/lib/http/safe-url";

const execute = promisify(execFile);

/** System certificate verification, bounded output and a public, pinned address at every hop. */
export async function fetchPublicViaCurl(raw: string, headers: Record<string, string>, timeoutMs: number): Promise<Response> {
  let url = await assertPublicHttpUrl(raw);
  const deadline = Date.now() + timeoutMs;
  for (let hop = 0; hop <= 5; hop++) {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = await lookup(host, { all: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new UnsafeUrlError("curl target does not resolve to public addresses");
    const address = addresses[0].address;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw Error("System reader deadline exceeded");
    const args = ["-q", "--silent", "--show-error", "--include", "--noproxy", "*", "--proto", "=http,https", "--max-time", String(remaining / 1000),
      "--resolve", `${host}:${url.port || (url.protocol === "https:" ? 443 : 80)}:${address.includes(":") ? `[${address}]` : address}`];
    for (const [name, value] of Object.entries(headers)) args.push("--header", `${name}: ${value}`);
    args.push("--url", url.href);
    const { stdout } = await execute("/usr/bin/curl", args, { encoding: "buffer", maxBuffer: 6_000_000, timeout: remaining + 1000, killSignal: "SIGKILL" });
    let buffer = stdout;
    let status = 0;
    let responseHeaders = new Headers();
    do {
      const split = buffer.indexOf("\r\n\r\n");
      if (split < 0) throw Error("Invalid system reader response");
      const lines = buffer.subarray(0, split).toString("latin1").split("\r\n");
      status = Number(lines.shift()?.match(/^HTTP\/[\d.]+\s+(\d{3})/)?.[1]);
      if (!status) throw Error("Invalid system reader status");
      responseHeaders = new Headers();
      for (const line of lines) {
        const separator = line.indexOf(":");
        if (separator > 0) responseHeaders.append(line.slice(0, separator), line.slice(separator + 1).trim());
      }
      buffer = buffer.subarray(split + 4);
    } while (status < 200);
    const location = responseHeaders.get("location");
    if ([301, 302, 303, 307, 308].includes(status) && location) {
      if (hop === 5) throw Error("Too many system reader redirects");
      url = await assertPublicHttpUrl(new URL(location, url));
      continue;
    }
    const response = new Response([204, 205, 304].includes(status) ? null : new Uint8Array(buffer), { status, headers: responseHeaders });
    Object.defineProperty(response, "url", { value: url.href });
    return response;
  }
  throw Error("System reader did not return a response");
}
