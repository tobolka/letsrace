/** ISO weekday: 1 = Monday … 7 = Sunday. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type IsoWeekday = (typeof ISO_WEEKDAYS)[number];

export function parseWeekdays(value: unknown): IsoWeekday[] {
  if (!Array.isArray(value)) return [];
  const out: IsoWeekday[] = [];
  for (const raw of value) {
    const n = Number(raw);
    if (n >= 1 && n <= 7) out.push(n as IsoWeekday);
  }
  return out;
}

export function parseDisciplines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

/** Date-only ISO (`YYYY-MM-DD`) → ISO weekday, timezone-safe. */
export function isoWeekdayFromIsoDate(iso: string): IsoWeekday {
  const [y, m, d] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  const js = utc.getUTCDay();
  return (js === 0 ? 7 : js) as IsoWeekday;
}

export function isBusyIsoDate(iso: string, busyWeekdays: number[]): boolean {
  if (busyWeekdays.length === 0) return false;
  return busyWeekdays.includes(isoWeekdayFromIsoDate(iso));
}

/** react-day-picker `dayOfWeek` matcher uses JS Sunday=0. */
export function toJsDayOfWeek(isoWeekdays: number[]): number[] {
  return isoWeekdays.map((n) => (n === 7 ? 0 : n));
}
