import * as cheerio from "cheerio";
import { htmlText } from "@/lib/catalog/regulation-ages";
import { embeddedDocumentText } from "@/lib/catalog/document-ocr";

type Registration = { Title?: string; InfoText?: string; ShowContests?: boolean; Contests?: { Name?: string; Start?: string }[] };
export type RaceResultRegistration = { EventDate?: string; EventDate2?: string; TabConfig?: { InfoText?: string }; Registrations?: Registration[] };

/** External Info tabs publish the organiser URL as Data, rather than InfoText. */
export function raceResultExternalInfo(config: { Data?: unknown }): string | null {
  if (typeof config.Data !== "string") return null;
  try {
    const url = new URL(config.Data.trim());
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

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
  const externalInfo = info.status === "fulfilled" && info.value ? raceResultExternalInfo(info.value) : null;
  const config = registration.status === "fulfilled" ? registration.value as RaceResultRegistration | null : null;
  const $ = cheerio.load(pageHtml);
  const metadata: string[] = [];
  $("script[type='application/ld+json']").each((_, node) => {
    try { const event = JSON.parse($(node).text()); if (event["@type"] === "Event") metadata.push(`Event: ${event.name}\nStart date: ${event.startDate}\nEnd date: ${event.endDate}`); } catch { /* Unusable structured data adds no evidence. */ }
  });
  const externalLink = externalInfo ? cheerio.load("<a></a>")("a").attr("href", externalInfo).attr("data-catalog-external-info", "true").text("Organiser race information — Technical guide").toString() : "";
  const html = `${pageHtml}\n${infoHtml}\n${externalLink}`;
  const ocr = await embeddedDocumentText(infoHtml).catch(() => "");
  const text = [metadata.join("\n"), htmlText(pageHtml), htmlText(infoHtml), externalInfo ? `Official organiser information: ${externalInfo}` : "", config ? registrationProgramme(config) : "", ocr].filter(Boolean).join("\n\n");
  return { html, text };
}
