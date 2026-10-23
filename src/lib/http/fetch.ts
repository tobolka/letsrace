import { fetchPublic } from "@/lib/http/safe-url";
import { catalogUserAgent } from "@/lib/http/user-agent";

export type BotFetchInit = Omit<RequestInit, "redirect"> & {
  /** Give up after this long. Default 20 s. */
  timeoutMs?: number;
};

/**
 * Read a page we were pointed at, as a polite bot.
 *
 * For every address that came from somewhere else — a source row, a link on
 * another site's page, a search result — rather than one we wrote down
 * ourselves. It refuses addresses that lead into the machine's own network
 * (every redirect hop included, see `fetchPublic`), says who it is (one
 * User-Agent, a browser's only for the hosts that block anything else) and
 * never waits forever. Anything the caller sets in `headers` wins.
 */
export function fetchBot(url: string, init: BotFetchInit = {}): Promise<Response> {
  const { timeoutMs = 20_000, headers, signal, ...rest } = init;
  const merged = new Headers(headers);
  if (!merged.has("user-agent")) merged.set("user-agent", catalogUserAgent(url));
  const deadline = AbortSignal.timeout(timeoutMs);
  return fetchPublic(url, {
    ...rest,
    headers: merged,
    signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
  });
}
