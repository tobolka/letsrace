import { describe, expect, it } from "vitest";
import { collectMonth, toEvent } from "@/lib/watcher/extractors/kalendarzrowerowy";

type Bucket = Map<string, { pin: { title: string; slug: string; bar?: string; lat?: number; lng?: number; url?: string }; days: Set<string> }>;

const pin = (over: Record<string, unknown> = {}) => ({
  title: "Reza Gravel (2026)",
  slug: "reza-gravel-2026",
  url: "/wydarzenie/reza-gravel-2026/",
  lat: 53.755834,
  lng: 17.478298,
  bar: "cal-bar-gravel",
  ...over,
});

const monthHtml = (pins: unknown[], cells: [string, string[]][]) => {
  const json = JSON.stringify(pins).replace(/"/g, "&quot;");
  const grid = cells
    .map(
      ([day, titles]) =>
        `<button data-day="${day}">${titles
          .map((t) => `<span class="home-month__bar is-middle" title="${t}"></span>`)
          .join("")}</button>`,
    )
    .join("");
  return `<div x-data="calendar" data-pins="${json}">${grid}</div>`;
};

describe("collectMonth", () => {
  it("joins a race's pin to the days it runs", () => {
    const into: Bucket = new Map();
    collectMonth(
      monthHtml(
        [pin()],
        [
          ["2026-09-11", ["Reza Gravel (2026)"]],
          ["2026-09-12", ["Reza Gravel (2026)"]],
          ["2026-09-13", ["Reza Gravel (2026)"]],
        ],
      ),
      into,
    );
    expect([...into.get("Reza Gravel (2026)")!.days].sort()).toEqual([
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
  });

  it("ignores a bar with no matching pin", () => {
    const into: Bucket = new Map();
    collectMonth(monthHtml([pin()], [["2026-09-11", ["Something Else"]]]), into);
    expect(into.has("Something Else")).toBe(false);
  });

  it("keeps days found across two months for the same race", () => {
    const into: Bucket = new Map();
    collectMonth(monthHtml([pin()], [["2026-09-30", ["Reza Gravel (2026)"]]]), into);
    collectMonth(monthHtml([pin()], [["2026-10-01", ["Reza Gravel (2026)"]]]), into);
    expect(into.get("Reza Gravel (2026)")!.days.size).toBe(2);
  });
});

describe("toEvent", () => {
  it("spans the race over the days it was seen", () => {
    expect(toEvent(pin(), new Set(["2026-09-13", "2026-09-11", "2026-09-12"]))).toMatchObject({
      externalId: "kalrow-reza-gravel-2026",
      name: "Reza Gravel",
      startDate: "2026-09-11",
      endDate: "2026-09-13",
      countryHint: "PL",
      discipline: ["gravel"],
      lat: 53.755834,
      sourceUrl: "https://kalendarzrowerowy.pl/wydarzenie/reza-gravel-2026/",
    });
  });

  it("drops the season from the title and leaves a one-day race open-ended", () => {
    const ev = toEvent(pin({ title: "Hardy Gravel (2026)" }), new Set(["2026-09-27"]));
    expect(ev).toMatchObject({ name: "Hardy Gravel", endDate: undefined });
  });

  it("takes the discipline from the bar colour when the name says nothing", () => {
    expect(toEvent(pin({ title: "Robinsonada Łódzka (2026)", bar: "cal-bar-szosa" }), new Set(["2026-09-05"]))?.discipline)
      .toEqual(["road"]);
  });

  it("ignores a pin that never appeared on a day", () => {
    expect(toEvent(pin(), new Set())).toBeNull();
  });
});
