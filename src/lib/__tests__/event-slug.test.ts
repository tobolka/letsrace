import { describe, expect, it } from "vitest";
import { eventSlugCandidates, slugWords } from "@/lib/domain";

describe("race addresses", () => {
  it("keeps the whole name and adds the year once", () => {
    expect(eventSlugCandidates("ČT AUTHOR CUP", "2026-10-10", "Bedřichov")).toEqual([
      "ct-author-cup-2026",
      "ct-author-cup-bedrichov-2026",
      "ct-author-cup-2026-10-10",
    ]);
    expect(eventSlugCandidates("3. závod VELO 2026 — Kladno", "2026-10-04", "Kladno")[0]).toBe("3-zavod-velo-kladno-2026");
    expect(eventSlugCandidates("Stevens Cup 2026/27", "2026-11-15")[0]).toBe("stevens-cup-2026");
  });

  it("spells letters NFD leaves alone", () => {
    expect(slugWords("Wyścig o Puchar Łodzi")).toBe("wyscig-o-puchar-lodzi");
    expect(slugWords("Großer Preis")).toBe("grosser-preis");
  });

  it("cuts long names at a word", () => {
    const slug = slugWords("ogólnopolski wyścig w kolarstwie przełajowym o puchar prezydenta Kielc Pani Agaty");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toBe("ogolnopolski-wyscig-w-kolarstwie-przelajowym-o-puchar");
  });
});
