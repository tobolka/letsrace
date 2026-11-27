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

import {
  classifyEventForAgentQueue,
  extractSourceCategories,
  judgeRide,
} from "@/lib/pipeline2/rides";
import { groupSameRace } from "@/lib/pipeline2/agent-case-groups";
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

describe("extractSourceCategories", () => {
  it("extracts federation categories from objects, nested payloads, JSON strings and notes", () => {
    expect(extractSourceCategories({ tipologia: "NON COMPETITIVA" })).toEqual(["NON COMPETITIVA"]);
    expect(
      extractSourceCategories({
        federation: { categoria: "Cicloturistica / Non competitiva", disciplina: "MTB" },
        raceClass: "ESCURSIONISMO",
      }),
    ).toEqual(["Cicloturistica / Non competitiva", "MTB", "ESCURSIONISMO"]);
    expect(extractSourceCategories('{"event_type":"RADWANDERN","category":"RECREATIONAL"}')).toEqual([
      "RADWANDERN",
      "RECREATIONAL",
    ]);
    expect(extractSourceCategories("Tipologia: NON COMPETITIVA\nDisciplina: Cicloturismo")).toEqual([
      "NON COMPETITIVA",
      "Cicloturismo",
    ]);
  });

  it("handles null, primitives and malformed JSON without throwing", () => {
    expect(extractSourceCategories(null)).toEqual([]);
    expect(extractSourceCategories(undefined)).toEqual([]);
    expect(extractSourceCategories(42)).toEqual([]);
    expect(extractSourceCategories("{not valid json")).toEqual([]);
    expect(extractSourceCategories(["{broken", { category: "NON_TIMED" }])).toEqual(["NON_TIMED"]);
  });
});

describe("classifyEventForAgentQueue", () => {
  it("catches BABBOBIKE marked NON COMPETITIVA by the Italian federation before extract_details", () => {
    const viaCategory = classifyEventForAgentQueue({
      id: "3c27cc3d-0000-0000-0000-000000000001",
      name: "BABBOBIKE",
      startDate: "2026-12-06",
      eventType: null,
      sourceCategories: ["NON COMPETITIVA"],
    });
    expect(viaCategory.action).toBe("skip_non_competitive");
    expect(viaCategory.judgement.kind).toBe("ride");

    const viaRawPayload = classifyEventForAgentQueue({
      id: "3c27cc3d-0000-0000-0000-000000000001",
      name: "BABBOBIKE",
      startDate: "2026-12-06",
      eventType: "race",
      sourceCategories: extractSourceCategories({ tipologia: "NON COMPETITIVA" }),
    });
    expect(viaRawPayload.action).toBe("skip_non_competitive");
    expect(viaRawPayload.judgement.kind).toBe("ride");

    const compound = judgeRide({
      name: "BABBOBIKE",
      eventType: null,
      sourceCategories: ["Cicloturistica / Non competitiva"],
    });
    expect(compound.kind).toBe("ride");
  });

  it("catches multilingual non-competitive categories and explicit ride eventType", () => {
    for (const cat of [
      "NON_COMPETITIVE",
      "CICLOTURISMO",
      "ESCURSIONISTICA",
      "PEDALATA",
      "RADWANDERN",
      "Cyklojízda",
      "Vyjížďka",
      "RECREATIONAL",
      "NON_TIMED",
    ]) {
      const res = classifyEventForAgentQueue({
        id: `ev-${cat}`,
        name: "Local Cycling Event",
        startDate: "2027-05-10",
        sourceCategories: [cat],
      });
      expect(res.action, cat).toBe("skip_non_competitive");
    }

    expect(
      classifyEventForAgentQueue({
        id: "ev-ride",
        name: "Sunday Ride",
        startDate: "2027-05-10",
        eventType: "ride",
      }).action,
    ).toBe("skip_non_competitive");
  });

  it("routes ambiguous events to decide_ride instead of extract_details", () => {
    const vagueCategory = classifyEventForAgentQueue({
      id: "amb-1",
      name: "Dolomiti Gravel Experience",
      startDate: "2027-06-12",
      sourceCategories: ["GRAVEL_TOUR"],
    });
    expect(vagueCategory.action).toBe("decide_ride");
    expect(vagueCategory.judgement.kind).toBe("unsure");

    const vagueTour = classifyEventForAgentQueue({
      id: "amb-2",
      name: "Bohemia Cycling Day",
      startDate: "2027-06-13",
      sourceCategories: ["TOUR"],
    });
    expect(vagueTour.action).toBe("decide_ride");
    expect(vagueTour.judgement.kind).toBe("unsure");

    const conflicting = classifyEventForAgentQueue({
      id: "amb-3",
      name: "Città Gravel",
      startDate: "2027-06-14",
      sourceCategories: ["NON COMPETITIVA"],
      sourceText: "Classifica generale e premiazione per categorie.",
    });
    expect(conflicting.action).toBe("decide_ride");
    expect(conflicting.judgement.kind).toBe("unsure");
  });

  it("skips a Saturday companion ride while still processing a separate Sunday race", () => {
    const saturdayRide = {
      id: "sat-ride-1",
      name: "BABBOBIKE Family Ride",
      startDate: "2026-12-05",
      eventType: null,
      sourceCategories: extractSourceCategories({ tipologia: "NON COMPETITIVA" }),
    };
    const sundayRace = {
      id: "sun-race-1",
      name: "Gran Fondo Città",
      startDate: "2026-12-06",
      eventType: null,
      sourceCategories: extractSourceCategories({ tipologia: "AGONISTICA" }),
    };

    const saturdayDecision = classifyEventForAgentQueue(saturdayRide);
    const sundayDecision = classifyEventForAgentQueue(sundayRace);

    expect(saturdayDecision.action).toBe("skip_non_competitive");
    expect(sundayDecision.action).toBe("process_race");

    // Different days also stay separate in groupSameRace.
    const grouped = groupSameRace([
      {
        case: "details-sat",
        race: {
          id: saturdayRide.id,
          name: saturdayRide.name,
          date: saturdayRide.startDate,
          place: "Milano",
          country: "IT",
        },
      },
      {
        case: "details-sun",
        race: {
          id: sundayRace.id,
          name: sundayRace.name,
          date: sundayRace.startDate,
          place: "Milano",
          country: "IT",
        },
      },
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped.map((item) => item.race.id)).toEqual(["sat-ride-1", "sun-race-1"]);
  });
});
