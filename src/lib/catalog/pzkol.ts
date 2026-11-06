/**
 * The Polish federation's page of a race names its organiser and links its regulations, under fixed headings.
 * Only the part above the page's calendar of other races is the race's own.
 */
const clean = (text: string) => text.replace(/\s+/g, " ").trim();

export const isPzkolRace = (url: string) => /pzkol\.pl\/kalendarz\/\d+,/i.test(url);

const ownPart = (text: string) => {
  const end = text.indexOf("Polski Związek Kolarski", text.indexOf("Region:") + 40);
  return end > 0 ? text.slice(0, end) : text;
};

/** The regulations linked from the page; the Polish version comes first, since the race's riders read it. */
export function pzkolRegulations(text: string): string[] {
  const own = ownPart(text), at = own.indexOf("Regulamin:");
  if (at < 0) return [];
  const links = [...own.slice(at).matchAll(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g)].map(match => ({ label: match[1]!, url: match[2]! }));
  return [...links.filter(link => /regulamin/i.test(link.label)), ...links.filter(link => !/regulamin/i.test(link.label))].map(link => link.url);
}

export function pzkolFacts(doc: { url: string; text: string }) {
  const own = ownPart(doc.text), facts: Record<string, unknown> = {};
  const day = /Data:\s*(\d{4}-\d{2}-\d{2})/.exec(own)?.[0], organiser = /Organizator:\s*\n+\s*([^\n]+)/.exec(own);
  if (day && organiser && clean(organiser[1]!).length >= 4) {
    const name = clean(organiser[1]!), quote = `Organizator: ${name}`;
    facts.organizer = { value: { name }, source_url: doc.url, quote, identity_quote: clean(own.split("\n").find(row => row.trim()) ?? quote), edition_quote: clean(day), status: "current" };
  }
  return { facts };
}
