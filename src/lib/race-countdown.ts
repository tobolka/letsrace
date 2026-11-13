/** "tomorrow", "in 9 days" — for a race within two months, else nothing. */
export function daysUntilLabel(date: string, locale: string, today = new Date()): string | null {
  const start = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((start - now) / 86_400_000);
  if (days < 0 || days > 60) return null;
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
}
