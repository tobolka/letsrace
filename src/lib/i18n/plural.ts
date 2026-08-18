import type { Locale } from "@/lib/i18n/messages";

export type PluralForm = "one" | "few" | "many";

/** Czech/Slovak/Polish-style 1 / 2–4 / 5+; English is 1 vs rest. */
export function pluralForm(n: number, locale: Locale): PluralForm {
  const abs = Math.abs(Math.trunc(n));
  if (locale === "en") return abs === 1 ? "one" : "many";

  const n10 = abs % 10;
  const n100 = abs % 100;
  if (locale === "pl") {
    if (abs === 1) return "one";
    if (n10 >= 2 && n10 <= 4 && n100 !== 12 && n100 !== 13 && n100 !== 14) return "few";
    return "many";
  }

  if (abs === 1) return "one";
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "few";
  return "many";
}

export function pluralize(
  n: number,
  locale: Locale,
  forms: { one: string; few: string; many: string },
) {
  return forms[pluralForm(n, locale)].replaceAll("{n}", String(n));
}
