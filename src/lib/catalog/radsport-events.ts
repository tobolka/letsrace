import type { Discipline, ParsedEvent } from "@/lib/domain";
import type { PracticalDetails } from "@/lib/practical-details";

export type RadsportEventApiItem = {
  id: number;
  title: string;
  description?: string | null;
  address?: string | null;
  locationName?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  eventDate: string;
  endDate?: string | null;
  startTime?: string | null;
  startTimeEnd?: string | null;
  organizer?: string | null;
  organizerUrl?: string | null;
  category?: string | null;
  eventType?: string | null;
  cancelled?: boolean;
  tentative?: boolean;
  permanent?: boolean;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distances?: {
    distanceKm?: number | null;
    elevationMeters?: number | null;
    routeUrl?: string | null;
    label?: string | null;
    startTime?: string | null;
  }[];
  links?: {
    url?: string | null;
    type?: string | null;
    visibility?: string | null;
  }[];
};

const INCLUDED_TYPES = new Set([
  "CYCLOCROSS",
  "GRAVEL_RACE",
  "CROSSCOUNTRY",
  "MTB_MARATHON",
  "ENDURO",
  "JEDERMANN",
  "HOBBYRENNEN",
  "RADMARATHON",
  "ETAPPENRENNEN",
  "EINZELZEITFAHREN",
  "BERGZEITFAHREN",
  "HILLCLIMB",
  "RENNEN_24H",
  "RENNEN_12H",
  "RENNEN_2_3_6H",
  "ULTRA",
  "BIKEPACKING",
  "BREVET",
  "GRAVEL_BREVET",
]);

export function isRadsportEventsRace(item: RadsportEventApiItem): boolean {
  if (!item.id || !item.title || !item.eventDate) return false;
  if (item.cancelled || item.tentative || item.permanent) return false;
  if (item.status && item.status !== "PUBLISHED") return false;
  if (!item.eventType || !INCLUDED_TYPES.has(item.eventType)) return false;
  return true;
}

export function radsportEventsId(url: string): number | null {
  const m = url.match(/^https:\/\/radsport-events\.de\/events\/(\d+)(?:\/|$)/);
  return m ? Number(m[1]) : null;
}

export function radsportEventsApiUrl(id: number): string {
  return `https://api.radsport-events.de/api/v1/events/${id}`;
}

export function radsportEventsWebUrl(id: number): string {
  return `https://radsport-events.de/events/${id}`;
}

function mapDiscipline(item: RadsportEventApiItem): Discipline {
  switch (item.eventType) {
    case "CYCLOCROSS": return "cx";
    case "CROSSCOUNTRY": return "xco";
    case "MTB_MARATHON": return "xcm";
    case "ENDURO": return "enduro";
    case "GRAVEL_RACE":
    case "GRAVEL_BREVET": return "gravel";
    case "JEDERMANN":
    case "RADMARATHON":
    case "EINZELZEITFAHREN":
    case "BERGZEITFAHREN":
    case "HILLCLIMB": return "road";
    default: {
      const cat = (item.category ?? "").toUpperCase();
      if (cat === "MTB") return "mtb";
      if (cat === "GRAVEL") return "gravel";
      return "road";
    }
  }
}

function publicUrl(u: string | null | undefined): string | undefined {
  if (!u) return undefined;
  const s = u.trim();
  if (!/^https?:\/\//i.test(s)) return undefined;
  return s;
}

export function radsportEventsParsedEvent(item: RadsportEventApiItem): ParsedEvent | null {
  if (!isRadsportEventsRace(item)) return null;
  const place = (item.city || item.locationName || item.address || "").trim();
  if (!place) return null;
  const webUrl = radsportEventsWebUrl(item.id);
  const publicLinks = (item.links ?? []).filter(l => l.visibility !== "PRIVATE" && publicUrl(l.url));
  const regLink = publicLinks.find(l => l.type === "REGISTRATION")?.url ?? undefined;
  const regDoc = publicLinks.find(l => l.type === "REGULATIONS")?.url ?? undefined;
  const nonFbWebsite = publicUrl(item.organizerUrl)
    ?? publicLinks.find(l => l.type === "WEBSITE" && !/facebook\.com|instagram\.com/i.test(l.url ?? ""))?.url
    ?? undefined;
  const country = item.country?.trim().toUpperCase();
  const startDate = item.eventDate.slice(0, 10);
  const endDate = item.endDate && item.endDate.slice(0, 10) !== startDate ? item.endDate.slice(0, 10) : undefined;
  const quote = `${item.title} | ${startDate}${endDate ? ` - ${endDate}` : ""} | ${place}${country ? ` (${country})` : ""} | ${item.eventType}`.slice(0, 280);
  return {
    externalId: `radsport-events:${item.id}`,
    name: item.title.trim(),
    startDate,
    ...(endDate ? { endDate } : {}),
    placeText: item.postalCode ? `${item.postalCode} ${place}` : place,
    ...(country && /^[A-Z]{2}$/.test(country) ? { countryHint: country } : {}),
    discipline: [mapDiscipline(item)],
    sourceUrl: webUrl,
    ...(nonFbWebsite ? { websiteUrl: nonFbWebsite } : {}),
    ...(regLink ? { registrationUrl: regLink } : {}),
    ...(regDoc ? { regulationsUrl: regDoc } : {}),
    confidence: 0.85,
    evidence: {
      quote,
      sourceUrl: webUrl,
      method: "radsport_events",
      version: "radsport-events-v1",
    },
  };
}

export function radsportEventsPracticalDetails(item: RadsportEventApiItem, now = new Date().toISOString()): PracticalDetails {
  const webUrl = radsportEventsWebUrl(item.id);
  const year = Number(item.eventDate.slice(0, 4));
  const out: PracticalDetails = {};
  if (item.organizer) {
    out.organizer = {
      value: {
        name: item.organizer.trim(),
        ...(publicUrl(item.organizerUrl) ? { url: publicUrl(item.organizerUrl) } : {}),
      },
      sourceUrl: webUrl,
      quote: `Veranstalter: ${item.organizer}`.slice(0, 300),
      checkedAt: now,
      editionYear: year,
      status: "current",
    };
  }
  const routes = (item.distances ?? [])
    .filter(d => typeof d.distanceKm === "number" && d.distanceKm > 0)
    .map(d => ({
      name: (d.label?.trim() || `${d.distanceKm} km`),
      distanceKm: d.distanceKm!,
      ...(typeof d.elevationMeters === "number" && d.elevationMeters > 0 ? { elevationM: d.elevationMeters } : {}),
      ...(publicUrl(d.routeUrl) ? { mapUrl: publicUrl(d.routeUrl) } : {}),
      sourceUrl: webUrl,
      sourceQuote: `${d.label || "Strecke"}: ${d.distanceKm} km${d.elevationMeters ? ` / ${d.elevationMeters} hm` : ""}`.slice(0, 300),
      checkedAt: now,
    }));
  if (routes.length) {
    out.routes = {
      value: routes,
      sourceUrl: webUrl,
      quote: routes.slice(0, 4).map(r => r.sourceQuote).join("\n").slice(0, 600),
      checkedAt: now,
      editionYear: year,
      status: "current",
    };
  }
  const schedule: { label: string; date: string; time: string; endTime?: string; sourceUrl: string; sourceQuote: string; checkedAt: string }[] = [];
  if (item.startTime && /^\d{2}:\d{2}/.test(item.startTime)) {
    schedule.push({
      label: "Start",
      date: item.eventDate.slice(0, 10),
      time: item.startTime.slice(0, 5),
      ...(item.startTimeEnd && /^\d{2}:\d{2}/.test(item.startTimeEnd) ? { endTime: item.startTimeEnd.slice(0, 5) } : {}),
      sourceUrl: webUrl,
      sourceQuote: `Start ${item.eventDate.slice(0, 10)} ${item.startTime.slice(0, 5)}`,
      checkedAt: now,
    });
  }
  for (const d of item.distances ?? []) {
    if (d.startTime && /^\d{2}:\d{2}/.test(d.startTime)) {
      schedule.push({
        label: d.label?.trim() || (d.distanceKm ? `${d.distanceKm} km` : "Start"),
        date: item.eventDate.slice(0, 10),
        time: d.startTime.slice(0, 5),
        sourceUrl: webUrl,
        sourceQuote: `${d.label || d.distanceKm + " km"} Start ${d.startTime.slice(0, 5)}`,
        checkedAt: now,
      });
    }
  }
  if (schedule.length) {
    out.schedule = {
      value: schedule,
      sourceUrl: webUrl,
      quote: schedule.slice(0, 3).map(s => s.sourceQuote).join("\n").slice(0, 600),
      checkedAt: now,
      editionYear: year,
      status: "current",
    };
  }
  return out;
}
