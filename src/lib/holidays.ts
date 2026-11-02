import type { Locale } from "@/lib/i18n/messages";

/**
 * What a race's date means for a family's calendar: a public holiday, a long
 * weekend, the summer school holidays. Public holidays come from Nager.Date
 * (free, every European country), held for a month; only nationwide ones —
 * a regional holiday would be wrong for most readers.
 */

type Holiday = { date: string; localName: string; name: string; global: boolean };

async function publicHolidays(countryCode: string, year: number): Promise<Holiday[]> {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`, {
    next: { revalidate: 30 * 86_400 },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  return ((await res.json()) as Holiday[]).filter((h) => h.global);
}

/** The holiday's name in the reader's language when it is the country's; English otherwise. */
const COUNTRY_LANGUAGE: Record<string, Locale> = { CZ: "cs", SK: "sk", PL: "pl", DE: "de", AT: "de", CH: "de" };

const COPY: Record<Locale, { holiday: string; longWeekend: string; summer: string }> = {
  cs: { holiday: "Státní svátek – {name}", longWeekend: "Prodloužený víkend – {name} ({day})", summer: "Letní školní prázdniny" },
  sk: { holiday: "Štátny sviatok – {name}", longWeekend: "Predĺžený víkend – {name} ({day})", summer: "Letné školské prázdniny" },
  pl: { holiday: "Święto państwowe – {name}", longWeekend: "Długi weekend – {name} ({day})", summer: "Wakacje szkolne" },
  de: { holiday: "Feiertag – {name}", longWeekend: "Langes Wochenende – {name} ({day})", summer: "Sommerferien" },
  en: { holiday: "Public holiday – {name}", longWeekend: "Long weekend – {name} ({day})", summer: "Summer school holidays" },
};

const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** Every day of the race, from its start to its end. */
function raceDays(start: string, end: string | null): string[] {
  const days = [start];
  while (end && days.at(-1)! < end && days.length < 14) days.push(shift(days.at(-1)!, 1));
  return days;
}

/**
 * The lines to show for a race, in the reader's language: "Státní svátek –
 * Den české státnosti", "Prodloužený víkend – Velký pátek (pátek)", "Letní
 * školní prázdniny". Empty when the date is an ordinary one.
 */
export async function raceHolidays(
  race: { startDate: string; endDate: string | null; countryCode: string | null },
  locale: Locale,
): Promise<string[]> {
  if (!race.countryCode) return [];
  const c = COPY[locale];
  const days = raceDays(race.startDate, race.endDate);
  const years = [...new Set([days[0], days.at(-1)!].map((d) => Number(d.slice(0, 4))))];
  const holidays = (await Promise.all(years.map((y) => publicHolidays(race.countryCode!, y).catch(() => [])))).flat();
  const nameOf = (h: Holiday) => (COUNTRY_LANGUAGE[race.countryCode!] === locale ? h.localName : h.name);
  const out: string[] = [];

  for (const h of holidays.filter((h) => days.includes(h.date))) out.push(c.holiday.replace("{name}", nameOf(h)));
  if (!out.length) {
    // A weekend race with Friday or Monday off makes a long weekend.
    const weekend = days.filter((d) => weekday(d) === 0 || weekday(d) === 6);
    if (weekend.length) {
      const edges = [shift(weekend[0], weekday(weekend[0]) === 6 ? -1 : -2), shift(weekend.at(-1)!, weekday(weekend.at(-1)!) === 0 ? 1 : 2)];
      const near = holidays.find((h) => edges.includes(h.date));
      if (near) {
        const day = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(`${near.date}T00:00:00Z`));
        out.push(c.longWeekend.replace("{name}", nameOf(near)).replace("{day}", day));
      }
    }
  }
  // Czech and Slovak schools are off for July and August.
  if ((race.countryCode === "CZ" || race.countryCode === "SK") && days.some((d) => d.slice(5, 7) === "07" || d.slice(5, 7) === "08")) {
    out.push(c.summer);
  }
  return out;
}
