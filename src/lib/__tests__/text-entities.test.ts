import { describe, expect, it } from "vitest";
import { repairText } from "@/lib/text";

describe("repairText entities", () => {
  it("decodes the entities scraped calendars leave in names", () => {
    expect(repairText("08.00&ndash;13.00 Uhr ARB&Ouml; St.P&ouml;ltner")).toBe("08.00–13.00 Uhr ARBÖ St.Pöltner");
    expect(repairText("Gro&szlig;er Preis &gt;&gt; mehr&hellip;")).toBe("Großer Preis >> mehr…");
    expect(repairText("Ausge&shy;schrieben")).toBe("Ausgeschrieben");
    expect(repairText("Kolarstwo &#379;ory &#x141;&oacute;d&#378;")).toBe("Kolarstwo Żory Łódź");
    expect(repairText("Tom &amp;amp; Jerry")).toBe("Tom & Jerry");
  });

  it("leaves text that only looks like an entity alone", () => {
    expect(repairText("Rock & Roll Race")).toBe("Rock & Roll Race");
    expect(repairText("A &unknownthing; B")).toBe("A &unknownthing; B");
  });
});
