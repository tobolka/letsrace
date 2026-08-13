import type { Audience } from "@/lib/domain";

export type ConcreteAudience = "kids" | "youth" | "adults";

type CatHint = {
  name?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  audience?: string | null;
};

/** Expand DB audience into concrete groups — never return bare "mixed". */
export function expandAudience(
  audience: string | null | undefined,
  categories?: CatHint[] | null,
): ConcreteAudience[] {
  const a = (audience || "").toLowerCase();
  if (a === "kids" || a === "youth" || a === "adults") return [a];

  const fromCats = inferFromCategories(categories);
  if (fromCats.length) return fromCats;

  // "mixed" / unknown → list who can typically start
  return ["kids", "youth", "adults"];
}

function inferFromCategories(categories?: CatHint[] | null): ConcreteAudience[] {
  if (!categories?.length) return [];
  const set = new Set<ConcreteAudience>();
  for (const c of categories) {
    const catAud = (c.audience || "").toLowerCase();
    if (catAud === "kids" || catAud === "youth" || catAud === "adults") {
      set.add(catAud);
      continue;
    }
    const blob = `${c.name || ""}`.toLowerCase();
    if (
      /kids|děti|deti|žák|zak|benjam|puppy|u[67]|u9|u11|u1[012]|\bmb\b|\bw[ue]\b/i.test(blob) ||
      (c.ageMax != null && c.ageMax <= 12)
    ) {
      set.add("kids");
    }
    if (
      /junior|youth|mládež|mladez|kadet|u1[3-9]|u2[0-3]|hobby/i.test(blob) ||
      (c.ageMin != null && c.ageMin >= 13 && (c.ageMax == null || c.ageMax <= 23))
    ) {
      set.add("youth");
    }
    if (
      /elite|master|dospěl|dospel|senior|amateur|open|u23|elite/i.test(blob) ||
      (c.ageMin != null && c.ageMin >= 19)
    ) {
      set.add("adults");
    }
  }
  const order: ConcreteAudience[] = ["kids", "youth", "adults"];
  return order.filter((x) => set.has(x));
}

export function formatAudienceList(
  audience: string | null | undefined,
  labels: Record<ConcreteAudience, string>,
  categories?: CatHint[] | null,
): string {
  return expandAudience(audience, categories)
    .map((k) => labels[k])
    .join(" · ");
}

export function asAudience(value: string): Audience {
  if (value === "kids" || value === "youth" || value === "adults" || value === "mixed") {
    return value;
  }
  return "mixed";
}
