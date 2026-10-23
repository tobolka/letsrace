import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import type { ParsedEvent } from "@/lib/domain";
import { cells, dmy, fold, pushOnce } from "@/lib/watcher/extractors/parse-helpers";

describe("parse helpers", () => {
  it("fold strips diacritics and case", () => expect(fold("Říčany ŠKODA")).toBe("ricany skoda"));

  it("dmy pads day and month", () => expect(dmy("3", "7", "2027")).toBe("2027-07-03"));

  it("cells reads the text of each td, whitespace collapsed", () => {
    const $ = cheerio.load("<table><tr><td> a \n b </td><td>c</td></tr></table>");
    expect(cells($, $("tr")[0]!)).toEqual(["a b", "c"]);
  });

  it("pushOnce keeps the first event per id and drops a same-day end date", () => {
    const events: ParsedEvent[] = [];
    const seen = new Set<string>();
    const ev = { externalId: "1", name: "A", startDate: "2027-01-01", endDate: "2027-01-01" } as ParsedEvent;
    pushOnce(events, seen, ev);
    pushOnce(events, seen, { ...ev, name: "B" });
    expect(events).toHaveLength(1);
    expect(events[0]!.endDate).toBeUndefined();
  });
});
