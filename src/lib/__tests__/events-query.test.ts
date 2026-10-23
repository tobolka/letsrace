import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventsQuerySchema } from "@/lib/api/events-query";
import { buildEventsQuery, type EventsQuery } from "@/lib/events-query";
import { parseQuery } from "@/lib/api/validate";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-23T09:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const BASE: EventsQuery = {
  q: "",
  series: "",
  dateFrom: "2026-10-24",
  dateTo: "2026-10-25",
  categories: [],
  disciplines: [],
  levels: [],
  country: [],
};
const BOX = { west: 14, south: 49, east: 15, north: 50 };

describe("buildEventsQuery", () => {
  it("is the shared catalogue for a plain window from today on, and leaves the viewport out", () => {
    const { shared, params } = buildEventsQuery({ ...BASE, disciplines: ["mtb"] }, BOX);
    expect(shared).toBe(true);
    expect(params.get("west")).toBeNull();
    expect(params.getAll("disciplines")).toEqual(["mtb"]);
  });

  it.each([
    ["a text search", { q: "pohar" }],
    ["a cup", { series: "kpz" }],
    ["a window that starts in the past", { dateFrom: "2026-10-01" }],
    ["no start date", { dateFrom: "" }],
  ])("asks the server for %s, with the viewport", (_name, change) => {
    const { shared, params } = buildEventsQuery({ ...BASE, ...change }, BOX);
    expect(shared).toBe(false);
    expect([params.get("west"), params.get("south"), params.get("east"), params.get("north")]).toEqual([
      "14", "49", "15", "50",
    ]);
  });

  it("asks for any date when there is no window at all", () => {
    const { params } = buildEventsQuery({ ...BASE, dateFrom: "", dateTo: "" }, null);
    expect(params.get("anyDate")).toBe("1");
    expect(params.get("dateFrom")).toBeNull();
  });

  it("trims the search text", () => {
    expect(buildEventsQuery({ ...BASE, q: "  prima  " }, null).params.get("q")).toBe("prima");
  });
});

describe("the contract with GET /api/events", () => {
  it("every request the client builds is one the route reads back as the same filters", () => {
    const query: EventsQuery = {
      q: "prima",
      series: "prima-cup",
      dateFrom: "2026-10-01",
      dateTo: "2026-12-31",
      categories: ["u13", "u15"],
      disciplines: ["mtb", "xco"],
      levels: ["regional"],
      country: ["CZ", "SK"],
    };
    const { params } = buildEventsQuery(query, BOX);
    const parsed = parseQuery(params, eventsQuerySchema);
    if (!parsed.ok) throw new Error("the route rejected the client's own request");
    expect(parsed.data).toMatchObject({
      q: "prima",
      series: "prima-cup",
      dateFrom: "2026-10-01",
      dateTo: "2026-12-31",
      categories: ["u13", "u15"],
      disciplines: ["mtb", "xco"],
      levels: ["regional"],
      country: ["CZ", "SK"],
      west: 14,
      south: 49,
      east: 15,
      north: 50,
      anyDate: false,
    });
  });

  it("a request with no window reads back as any date", () => {
    const { params } = buildEventsQuery({ ...BASE, dateFrom: "", dateTo: "" }, null);
    const parsed = parseQuery(params, eventsQuerySchema);
    expect(parsed.ok && parsed.data.anyDate).toBe(true);
  });
});
