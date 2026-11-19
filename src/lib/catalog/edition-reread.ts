const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type PreviousRead = {
  at: string;
  requestAttempted?: boolean;
  asksVerification?: boolean;
  error?: string;
  status?: number;
  needsBrowser?: boolean;
  rendered?: boolean;
};

export function editionRereadAt(page: PreviousRead, failures: number, browserEnabled: boolean): number {
  const at = Date.parse(page.at);
  if (page.requestAttempted === false || page.asksVerification) return at + 7 * DAY;
  if (page.error || (page.status ?? 0) >= 400) {
    return at + Math.min(14 * DAY, 6 * HOUR * 2 ** Math.max(0, failures - 1));
  }
  if (page.needsBrowser && page.rendered) return at + 14 * DAY;
  if (page.needsBrowser && browserEnabled) return at + 6 * HOUR;
  return at + 5 * DAY;
}
