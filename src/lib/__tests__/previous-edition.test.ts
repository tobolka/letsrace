import { describe, expect, it } from "vitest";
import { editionKey } from "@/lib/catalog/previous-edition";

describe("editionKey", () => {
  it("drops the year and the edition number", () => {
    expect(editionKey("32. ročník Českopetrovická koolna 2026")).toBe(editionKey("31. ročník Českopetrovická koolna 2025"));
    expect(editionKey("XXXIX Ślężański Mnich")).toBe(editionKey("XL Ślężański Mnich"));
    expect(editionKey("Mikulášský cyklokros - Břeccross 2025")).toBe(editionKey("Mikulášský cyklokros - Břeccross 2026"));
    expect(editionKey("CycloCross im STEVENS-Cup 2026/2027 RG Wedel")).toBe(editionKey("CycloCross im STEVENS-Cup 2025/2026 RG Wedel"));
  });

  it("keeps what tells two races apart", () => {
    expect(editionKey("Oderský pohár — Zlaté Hory I.")).not.toBe(editionKey("Oderský pohár — Krnov"));
  });
});
