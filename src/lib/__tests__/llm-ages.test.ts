import { describe, expect, it } from "vitest";
import { relevantWindows, verifiedCategories } from "@/lib/catalog/llm-ages";

describe("llm ages", () => {
  it("keeps only the stretches of a page that talk about classes", () => {
    const text = `${"Lorem ipsum dolor sit amet. ".repeat(200)}\nKategorie: žáci, kadeti, junioři, muži\n${"Parkování a občerstvení. ".repeat(200)}`;
    const out = relevantWindows(text, 2000);
    expect(out).toContain("Kategorie: žáci");
    expect(out.length).toBeLessThanOrEqual(2000);
  });

  it("throws away a category whose quote is not on the page", () => {
    const text = "Kategorie: žáci U13, kadeti U15 a junioři.";
    const good = verifiedCategories(
      { categories: [{ name: "U13", quote: "žáci U13" }, { name: "U19", quote: "mládež U19" }, { name: "U15", quote: "KADETI  u15" }] },
      text,
    );
    expect(good.map((c) => c.name)).toEqual(["U13", "U15"]);
  });
});
