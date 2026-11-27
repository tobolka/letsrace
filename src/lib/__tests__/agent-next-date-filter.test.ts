import { describe, expect, it } from "vitest";
import {
  candidateRowToExistingEdition,
  filterExistingNextDateCases,
  hasTargetEdition,
  type ExistingEditionRecord,
  type NextDateCandidate,
} from "@/lib/pipeline2/agent-next-date-filter";

describe("agent next-date target edition filter", () => {
  const roadClassics2026: { case: string; race: NextDateCandidate }[] = [
    {
      case: "nextdate-rc-palava",
      race: {
        id: "rc-palava-2026",
        name: "Road Classics Pálava",
        last_date: "2026-05-16",
        place: "Pavlov",
        country: "CZ",
        series: "Road Classics",
        organizer: "Raul s.r.o.",
        disciplines: ["road"],
        website: "https://www.roadclassics.cz/",
      },
    },
    {
      case: "nextdate-rc-vysocina",
      race: {
        id: "rc-vysocina-2026",
        name: "Road Classics Vysočina",
        last_date: "2026-07-18",
        place: "Nové Město na Moravě",
        country: "CZ",
        series: "Road Classics",
        organizer: "Raul s.r.o.",
        disciplines: ["road"],
        website: "https://www.roadclassics.cz/",
      },
    },
    {
      case: "nextdate-rc-jested",
      race: {
        id: "rc-jested-2026",
        name: "Road Classics Ještěd",
        last_date: "2026-09-12",
        place: "Liberec",
        country: "CZ",
        series: "Road Classics",
        organizer: "Raul s.r.o.",
        disciplines: ["road"],
        website: "https://www.roadclassics.cz/",
      },
    },
  ];

  it("filters out Road Classics Pálava, Vysočina, and Ještěd when 2027 editions exist in catalogue or pending proposals", () => {
    const existing: ExistingEditionRecord[] = [
      {
        id: "cat-palava-2027",
        source: "catalogue",
        name: "Direct Road Classics 2027 – Pálava",
        start_date: "2027-05-15",
        place: "Mikulov",
        country: "CZ",
        series: "Direct Road Classics",
        disciplines: ["road", "gran_fondo"],
        website: "https://roadclassics.cz/palava",
      },
      {
        id: "cand-vysocina-2027",
        source: "pending_proposal",
        name: "Direct Road Classics 2027 - Vysočina",
        start_date: "2027-07-17",
        place: "Nové Město na Moravě",
        country: "CZ",
        series: "Road Classics",
        disciplines: ["road"],
        website: "https://roadclassics.cz/",
      },
      {
        id: "cat-jested-2027",
        source: "catalogue",
        name: "Direct Road Classics Ještěd 2027",
        start_date: "2027-09-11",
        place: "Liberec",
        country: "CZ",
        disciplines: ["road_race"],
        website: "https://www.roadclassics.cz/jested",
      },
    ];

    const palavaMatch = hasTargetEdition(roadClassics2026[0]!.race, 2027, existing);
    expect(palavaMatch.matched).toBe(true);
    expect(palavaMatch.via).toBe("catalogue");
    expect(palavaMatch.matchedId).toBe("cat-palava-2027");

    const vysocinaMatch = hasTargetEdition(roadClassics2026[1]!.race, 2027, existing);
    expect(vysocinaMatch.matched).toBe(true);
    expect(vysocinaMatch.via).toBe("pending_proposal");
    expect(vysocinaMatch.matchedId).toBe("cand-vysocina-2027");

    const jestedMatch = hasTargetEdition(roadClassics2026[2]!.race, 2027, existing);
    expect(jestedMatch.matched).toBe(true);
    expect(jestedMatch.via).toBe("catalogue");
    expect(jestedMatch.matchedId).toBe("cat-jested-2027");

    expect(filterExistingNextDateCases(roadClassics2026, 2027, existing)).toHaveLength(0);
  });

  it("does not let one Road Classics round suppress another unannounced round sharing the same series website", () => {
    const onlyPalava2027: ExistingEditionRecord[] = [
      {
        id: "cat-palava-2027",
        source: "catalogue",
        name: "Direct Road Classics 2027 – Pálava",
        start_date: "2027-05-15",
        place: "Pavlov",
        country: "CZ",
        series: "Road Classics",
        organizer: "Raul s.r.o.",
        disciplines: ["road"],
        website: "https://www.roadclassics.cz/",
      },
    ];

    const remaining = filterExistingNextDateCases(roadClassics2026, 2027, onlyPalava2027);
    expect(remaining.map((c) => c.case)).toEqual(["nextdate-rc-vysocina", "nextdate-rc-jested"]);
  });

  it("does not suppress XCM in Trieb when only XCO in Trieb exists for 2027", () => {
    const triebXcm2026: NextDateCandidate = {
      id: "trieb-xcm-2026",
      name: "CUBE Cup Trieb XCM",
      last_date: "2026-07-12",
      place: "Trieb",
      country: "DE",
      series: "CUBE Cup",
      disciplines: ["mtb", "xcm"],
      website: "https://cup.cube.eu/",
    };
    const triebXco2027: ExistingEditionRecord = {
      id: "trieb-xco-2027",
      source: "catalogue",
      name: "CUBE Cup Trieb XCO",
      start_date: "2027-07-11",
      place: "Trieb",
      country: "DE",
      series: "CUBE Cup",
      disciplines: ["mtb", "xco"],
      website: "https://cup.cube.eu/",
    };

    expect(hasTargetEdition(triebXcm2026, 2027, [triebXco2027])).toEqual({ matched: false });
  });

  it("ignores editions from other years", () => {
    const only2026: ExistingEditionRecord[] = [
      {
        id: "cat-palava-2026",
        source: "catalogue",
        name: "Road Classics Pálava",
        start_date: "2026-05-16",
        place: "Pavlov",
        country: "CZ",
        series: "Road Classics",
        disciplines: ["road"],
        website: "https://www.roadclassics.cz/",
      },
    ];

    expect(hasTargetEdition(roadClassics2026[0]!.race, 2027, only2026)).toEqual({ matched: false });
  });

  it("converts pipeline_candidates rows (flat ParsedEvent payload) into pending_proposal records", () => {
    const converted = candidateRowToExistingEdition({
      id: "cand-1",
      source_url: "https://www.roadclassics.cz/",
      country: "CZ",
      season: 2027,
      payload: {
        name: "Direct Road Classics 2027 – Ještěd",
        startDate: "2027-09-11",
        placeText: "Liberec",
        countryHint: "CZ",
        discipline: ["road"],
        seriesName: "Road Classics",
        websiteUrl: "https://www.roadclassics.cz/jested",
      },
    });

    expect(converted).not.toBeNull();
    const match = hasTargetEdition(roadClassics2026[2]!.race, 2027, [converted!]);
    expect(match).toMatchObject({ matched: true, via: "pending_proposal", matchedId: "cand-1" });
  });
});
