import { describe, expect, it } from "vitest";
import { looksLikeRide } from "@/lib/pipeline2/rides";

describe("names that read like a ride without a result", () => {
  it("knows brevets, RTF, CTF and rajd", () => {
    for (const name of ["Brevet Rheinland 200", "BRM 400 Wasserkinder", "Lehrter RTF", "Stahlrad Laatzen Advents-CTF", "Nocny Rajd Rowerowy - Wągrowiec", "Bydgoski Rowerowy Rajd Niepodległości", "Randonnée des Vosges", "Spanilá jízda"]) expect(looksLikeRide(name), name).toBe(true);
  });
  it("leaves timed races alone, also the ones open to everyone", () => {
    for (const name of ["Bikemaraton Drásal", "Schleizer Dreieck Jedermann", "UCI Gran Fondo Burgenland", "Mladá Boleslav Tour", "Antoniana Gravel", "Kolo pro život — Ralsko MTB Tour", "Cyklokros Slavkov u Brna", "Giro delle Dolomiti"]) expect(looksLikeRide(name), name).toBe(false);
  });
});

import { judgeRide } from "@/lib/pipeline2/rides";
import { radsportEventToParsed, radsportRideJudgement } from "@/lib/watcher/extractors/radsport";
import { newRaceProblems } from "@/lib/local-pass/new-race-check";

// Read on 2026-11-14 from https://api.radsport-events.de/api/v1/events/27831 and /234.
const BREVET_LIMBURG = { id: 27831, title: "Brevet 200 - Limburg", eventType: "BREVET", category: "ROAD", eventDate: "2027-03-13", city: "Köln", country: "DE",
  description: "Das Brevet Limburg führt über 200 km und startet an der Sporthochschule in Köln. \nEs ist kein Wettrennen, die Teilnehmer teilen sich ihre Pausen selbst ein." };
const RTF_MERKLINGEN = { id: 234, title: "40. Würm-Enztal Radtourenfahrt 2027", eventType: "RTF", category: "ROAD", eventDate: "2027-05-27", city: "Merklingen", country: "DE",
  description: "Die Würm-Enztal-Radtourenfahrt bietet fünf Strecken für unterschiedliche Leistungsniveaus: von der 24-km-Familientour bis zur 171-km-Extremstrecke." };

describe("rides are recognised when they are read", () => {
  it("settles Brevet Limburg from the organiser's own words", () => {
    expect(radsportRideJudgement(BREVET_LIMBURG)).toEqual({ kind: "ride", why: "organiser: es ist kein wettrennen" });
    expect(radsportEventToParsed(BREVET_LIMBURG)?.eventType).toBe("ride");
  });
  it("settles RTF Merklingen from the source's event type", () => {
    expect(radsportRideJudgement(RTF_MERKLINGEN).kind).toBe("ride");
    expect(radsportEventToParsed(RTF_MERKLINGEN)?.eventType).toBe("ride");
  });
  it("does not let Tour or Marathon in a name decide", () => {
    for (const name of ["Mladá Boleslav Tour", "Radmarathon Tannheimer Tal", "Bikemaraton Drásal", "UCI Gran Fondo Burgenland"]) expect(judgeRide({ name }).kind, name).toBe("race");
    expect(judgeRide({ name: "Gravel Tour Eifel", eventType: "GRAVEL_TOUR" }).kind).toBe("unsure");
  });
  it("keeps timed marathons and gran fondos as races, also when typed as a tour", () => {
    expect(judgeRide({ name: "Rhön Radmarathon", eventType: "RADMARATHON", text: "Zeitnahme per Chip, Siegerehrung um 16 Uhr" }).kind).toBe("race");
    const timedTour = { id: 9, title: "Gravel Tour Eifel", eventType: "GRAVEL_TOUR", eventDate: "2027-05-01", description: "Mit Zeitnahme und Wertung in drei Altersklassen." };
    expect(radsportRideJudgement(timedTour).kind).toBe("race");
    expect(radsportEventToParsed(timedTour)?.eventType).toBeUndefined();
  });
  it("reads explicit statements in other languages", () => {
    expect(judgeRide({ name: "Cyklojízda Krušnohořím", text: "Nejde o závod, bez měření času." }).kind).toBe("ride");
    expect(judgeRide({ name: "Granfondo del Po", text: "Manifestazione non competitiva" }).kind).toBe("ride");
    expect(judgeRide({ name: "Brevet 300", text: "Ergebnisliste und Siegerehrung" }).kind).toBe("unsure");
  });
  it("lets a settled ride through the cycle's last check and holds a vague one", () => {
    const place = { municipality: "Köln", country_code: "DE" };
    const base = { id: "a", start_date: "2027-03-13", visibility: "public", event_type: "ride" };
    expect(newRaceProblems({ ...base, name: "Brevet 200 - Limburg" }, place, [], "2026-11-14")).not.toContain("listed_as_a_ride");
    expect(newRaceProblems({ ...base, name: "Gravel Tour Eifel" }, place, [], "2026-11-14")).toContain("listed_as_a_ride");
  });
});
