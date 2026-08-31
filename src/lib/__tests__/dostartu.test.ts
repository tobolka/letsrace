import { describe, expect, it } from "vitest";
import { toEvent } from "@/lib/watcher/extractors/dostartu";

const row = (over: Record<string, unknown> = {}) => ({
  id: 15786,
  type: 31,
  name: "4. Szutry Śląskie 2026 Rybnik - Kamień",
  startedTime: "2026-09-05T09:00:00+02:00",
  endDate: null,
  location: "Rybnik-Kamień",
  locationLat: 50.1396863,
  locationLng: 18.5,
  permaLink: "/permalink-v15786",
  websitePl: "http://szutryslaskie.pl/",
  ...over,
});

describe("dostartu toEvent", () => {
  it("reads a cycling entry", () => {
    expect(toEvent(row())).toMatchObject({
      externalId: "dostartu-15786",
      name: "4. Szutry Śląskie 2026 Rybnik - Kamień",
      startDate: "2026-09-05",
      placeText: "Rybnik-Kamień",
      countryHint: "PL",
      lat: 50.1396863,
      lng: 18.5,
      websiteUrl: "http://szutryslaskie.pl/",
      registrationUrl: "https://dostartu.pl/permalink-v15786",
    });
  });

  it("keeps only the two cycling sports", () => {
    expect(toEvent(row({ type: 1 }))).toBeNull();
    expect(toEvent(row({ type: 46 }))).toBeNull();
    expect(toEvent(row({ type: 36 }))).not.toBeNull();
  });

  it("falls back to the sport when the name names no discipline", () => {
    expect(toEvent(row({ name: "Wyścig o Puchar Wójta" }))?.discipline).toEqual(["road"]);
    expect(toEvent(row({ type: 36, name: "Wyścig o Puchar Wójta" }))?.discipline).toEqual(["mtb"]);
  });

  it("prefers a discipline read off the name", () => {
    expect(toEvent(row({ name: "GRYFICKI MARATON GRAVEL RACE 2026" }))?.discipline).toEqual([
      "gravel",
    ]);
  });

  it("adds the missing scheme to a hand-typed organiser site", () => {
    expect(toEvent(row({ websitePl: "gryfus.szczecin.pl/ultra-gryfus-2026" }))?.websiteUrl).toBe(
      "https://gryfus.szczecin.pl/ultra-gryfus-2026",
    );
  });

  it("drops an unusable or self-referential organiser site", () => {
    expect(toEvent(row({ websitePl: "" }))?.websiteUrl).toBeUndefined();
    expect(toEvent(row({ websitePl: "brak" }))?.websiteUrl).toBeUndefined();
    expect(toEvent(row({ websitePl: "https://dostartu.pl/x" }))?.websiteUrl).toBeUndefined();
  });

  it("marks a children's round as kids", () => {
    expect(toEvent(row({ name: "PUCHAREK TARNOWA MTB - KIDS" }))?.audience).toBe("kids");
    expect(toEvent(row())?.audience).toBe("mixed");
  });

  it("keeps a multi-day end date but drops a same-day one", () => {
    expect(toEvent(row({ endDate: "2026-09-06T00:00:00+02:00" }))?.endDate).toBe("2026-09-06");
    expect(toEvent(row({ endDate: "2026-09-05T18:00:00+02:00" }))?.endDate).toBeUndefined();
  });

  it("rejects a row with no usable date or name", () => {
    expect(toEvent(row({ startedTime: null }))).toBeNull();
    expect(toEvent(row({ name: "" }))).toBeNull();
  });
});
