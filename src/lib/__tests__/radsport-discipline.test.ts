import { describe, expect, it } from "vitest";
import { mapCategory } from "@/lib/watcher/extractors/radsport";

describe("radsport-events discipline", () => {
  it("takes gravel from the name when the listing only says road", () => {
    expect(mapCategory(null, null, "RTF", "Maifelder Gravel Loops")).toEqual(["gravel"]);
    expect(mapCategory(null, null, null, "Canyon Rhein Hunsrück Gravel Marathon")).toEqual(["gravel"]);
  });

  it("keeps a stated discipline over the name", () => {
    expect(mapCategory(null, null, "CROSSCOUNTRY", "Gravel & MTB Cup")).toEqual(["xco"]);
    expect(mapCategory(null, null, "RADMARATHON", "Gravel-free Radmarathon")).toEqual(["road", "gran_fondo"]);
  });

  it("leaves a road race without gravel in its name alone", () => {
    expect(mapCategory(null, null, "RTF", "RTF Rund um Köln")).toEqual(["road"]);
  });
});
