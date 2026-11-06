/**
 * Sign-up portals list their races with an exact link to enter, and some with the regulations and a contact.
 * Each parser reads the portal's own list as the page reader gives it.
 */
export type PortalRow = { date: string; title: string; place: string; signUp: string; page?: string };

const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const POLISH_MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

/** `07.11.2026 | C-CX | Hůrka | [Name - přihláška](entry) | …`; only its cycling rows. */
export function maratonRows(text: string): PortalRow[] {
  return [...text.matchAll(/^(\d{2})\.(\d{2})\.(\d{4}) \| (C-[^|]*?) \| ([^|]*?) \| \[([^\]]+)\]\((https?:[^)\s]+\/entry\/\d+)\)/gm)].map(match => ({
    date: `${match[3]}-${match[2]}-${match[1]}`, place: clean(match[5]!), title: clean(match[6]!.replace(/\s*-\s*přihláška\s*$/i, "")), signUp: match[7]!,
  }));
}

/** `14.11.2026 - 5. Závod JANEV Cup 2026 (Jičín, CZ)` followed by its link to enter. */
export function sportsoftRows(text: string): PortalRow[] {
  const rows: PortalRow[] = [];
  for (const match of text.matchAll(/^(\d{1,2})\.(\d{1,2})\.(\d{4}) - (.+?) \(([^,)]+)[^)]*\)[\s\S]*?\[PŘIHLÁSIT SE\]\((https?:[^)\s]+)\)/gm)) {
    rows.push({ date: `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`, title: clean(match[4]!), place: clean(match[5]!), signUp: match[6]! });
  }
  return rows;
}

/** `[14 listopada 2026 Town](page)` then `[Title](page)`. */
export function wynikiRows(text: string): PortalRow[] {
  const rows = new Map<string, PortalRow>();
  for (const match of text.matchAll(/\[(\d{1,2}) (\p{L}+) (\d{4}) ([^\]]+)\]\((https?:[^)\s]+\/zawody\/\d+)\)\s*\[([^\]]+)\]\(\5\)/gu)) {
    const month = POLISH_MONTHS.indexOf(match[2]!.toLowerCase());
    if (month < 0) continue;
    rows.set(match[5]!, { date: `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1]!.padStart(2, "0")}`, place: clean(match[4]!), title: clean(match[6]!), signUp: match[5]!, page: match[5]! });
  }
  return [...rows.values()];
}

/** `[Town, "Name"](…/strona.html) - 2026-11-11 14:00 | … | [Zapisz się](…/signup.html)`. */
export function elektroniczneRows(text: string): PortalRow[] {
  return [...text.matchAll(/\[([^,\]]+), "?([^\]]*?)"?\]\((https?:[^)\s]+\/strona\.html)\)\s*-\s*(\d{4}-\d{2}-\d{2})[^\n]*?\[Zapisz się\]\((https?:[^)\s]+)\)/g)].map(match => ({
    date: match[4]!, place: clean(match[1]!), title: clean(match[2]!), page: match[3]!, signUp: match[5]!,
  }));
}

/** On a wynikizawodow page: the regulations and the organiser's address. */
export function wynikiPage(text: string): { regulations?: string; email?: string } {
  const regulations = /\[Regulamin[^\]]*\]\((https?:[^)\s]+\.pdf)\)/i.exec(text)?.[1];
  const email = /Kontakt do organizatora:[\s\S]{0,40}?([\w.+-]+@[\w-]+\.[\w.-]+)/i.exec(text)?.[1];
  return { ...(regulations ? { regulations } : {}), ...(email ? { email } : {}) };
}

const fold = (text: string) => text.toLowerCase().replaceAll("ł", "l").normalize("NFD").replace(/\p{M}/gu, "");
const words = (text: string) => new Set(fold(text).match(/[a-z0-9]{4,}/g) ?? []);
const COMMON = new Set(["cross", "cyclo", "cyclocross", "cyklokros", "2026", "2027", "race", "wyscig", "zavod", "gravel", "serie", "seria", "puchar", "pohar", "kolarstwie", "przelajowy", "przelajowym", "memorial", "memorial"]);

/** Which of a day's races a portal row means. A tie on one shared word means nothing; two shared words are one race listed twice. */
export function matchPortalRow<T extends { name: string; start_date: string; location?: { municipality?: string | null } | null }>(row: PortalRow, races: T[]): T[] {
  const own = words(`${row.title} ${row.place}`);
  const scored = races.filter(race => race.start_date === row.date).map(race => ({ race, shared: [...words(`${race.name} ${race.location?.municipality ?? ""}`)].filter(word => own.has(word) && !COMMON.has(word)).length })).filter(item => item.shared > 0).sort((a, b) => b.shared - a.shared);
  if (!scored.length) return [];
  const top = scored[0]!.shared, same = scored.filter(item => item.shared === top);
  return same.length > 1 && top < 2 ? [] : same.map(item => item.race);
}
