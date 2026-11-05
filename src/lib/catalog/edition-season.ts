/**
 * The past season whose next editions are being looked for. Organisers announce
 * the coming year's dates through its winter and spring, so the calendar year
 * turning over must not end the search: until October we still look for this
 * year's editions, and from October for next year's.
 */
export function defaultEditionSeason(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "numeric" }).formatToParts(now);
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  return part("month") >= 10 ? part("year") : part("year") - 1;
}
