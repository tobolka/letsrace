import { describe, expect, it } from "vitest";
import { raceCountLabel } from "@/components/shell/race-count";

describe("raceCountLabel", () => {
  it.each([
    [0, "0 závodů"], [1, "1 závod"], [2, "2 závody"], [4, "4 závody"], [5, "5 závodů"], [22, "22 závodů"], [64, "64 závodů"],
  ])("says %i in Czech as %s", (n, text) => expect(raceCountLabel(n, "cs")).toBe(text));

  it("takes Slovak's forms the same way", () => {
    expect(raceCountLabel(1, "sk")).toMatch(/^1 /);
    expect(raceCountLabel(3, "sk")).not.toBe(raceCountLabel(5, "sk"));
  });

  it("uses the plural rules of the other languages", () => {
    expect(raceCountLabel(1, "en")).toBe("1 race");
    expect(raceCountLabel(2, "en")).toBe("2 races");
    expect(raceCountLabel(22, "pl")).not.toBe(raceCountLabel(5, "pl"));
  });
});
