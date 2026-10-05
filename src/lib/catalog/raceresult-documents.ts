import * as cheerio from "cheerio";
import { htmlText } from "@/lib/catalog/regulation-ages";
import { embeddedDocumentText } from "@/lib/catalog/document-ocr";

type Registration = { Title?: string; InfoText?: string; ShowContests?: boolean; Contests?: { Name?: string; Start?: string }[] };
export type RaceResultRegistration = { EventDate?: string; EventDate2?: string; TabConfig?: { InfoText?: string }; Registrations?: Registration[] };

/** Only public admission text and contest labels; never participant data. */
export function registrationProgramme(config: RaceResultRegistration): string {
  return [config.EventDate ? `Event starts: ${config.EventDate.slice(0, 10)}` : "", config.EventDate2 ? `Event ends: ${config.EventDate2.slice(0, 10)}` : "",
    htmlText(config.TabConfig?.InfoText ?? ""), ...(config.Registrations ?? []).flatMap((r) => [
      r.Title ?? "", htmlText(r.InfoText ?? ""), ...(r.Contests ?? []).map((c) => `${c.Name ?? ""}${c.Start ? ` — ${c.Start.slice(0, 10)}` : ""}`),
    ])].filter(Boolean).join("\n");
}

export async function raceResultDocument(url: string, pageHtml: string): Promise<{ html: string; text: string } | null> {
  const eventId = new URL(url).pathname.match(/^\/(\d+)(?:\/|$)/)?.[1];
  if (!eventId) return null;
  const get = async (tab: string) => {
    const response = await fetch(`https://my.raceresult.com/${eventId}/${tab}/config?lang=en&sanitize=1`, { signal: AbortSignal.timeout(20_000) });
    return response.ok ? response.json() : null;
  };
  const [info, registration] = await Promise.allSettled([get("info"), get("registration")]);
  const infoHtml = info.status === "fulfilled" && typeof info.value?.InfoText === "string" ? info.value.InfoText as string : "";
  const config = registration.status === "fulfilled" ? registration.value as RaceResultRegistration | null : null;
  const $ = cheerio.load(pageHtml);
  const metadata: string[] = [];
  $("script[type='application/ld+json']").each((_, node) => {
    try { const event = JSON.parse($(node).text()); if (event["@type"] === "Event") metadata.push(`Event: ${event.name}\nStart date: ${event.startDate}\nEnd date: ${event.endDate}`); } catch { /* Unusable structured data adds no evidence. */ }
  });
  const html = `${pageHtml}\n${infoHtml}`;
  const ocr = await embeddedDocumentText(infoHtml).catch(() => "");
  const text = [metadata.join("\n"), htmlText(pageHtml), htmlText(infoHtml), config ? registrationProgramme(config) : "", ocr].filter(Boolean).join("\n\n");
  return { html, text };
}
