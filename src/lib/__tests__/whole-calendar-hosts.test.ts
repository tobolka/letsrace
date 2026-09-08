import { describe, expect, it } from "vitest";
import { isWholeCalendarHost } from "@/lib/watcher/extractors/adapters";

/**
 * mtbs.cz had grown to fifty watched URLs, each of which its adapter answered
 * with the same 157 races, because every page it fetched offered links to the
 * others and each link became a watch.
 */
describe("isWholeCalendarHost", () => {
  it("knows the hosts whose adapter ignores the URL", () => {
    expect(isWholeCalendarHost("mtbs.cz")).toBe(true);
    expect(isWholeCalendarHost("www.mtbs.cz")).toBe(true);
    expect(isWholeCalendarHost("radsport-events.de")).toBe(true);
    expect(isWholeCalendarHost("sportt.cz")).toBe(true);
  });

  it("leaves alone the ones whose pages are each a different race", () => {
    expect(isWholeCalendarHost("sumator.cz")).toBe(false);
    expect(isWholeCalendarHost("members.federciclismo.it")).toBe(false);
    // Not a suffix match on a longer name that merely ends the same way.
    expect(isWholeCalendarHost("notmtbs.cz")).toBe(false);
  });
});
