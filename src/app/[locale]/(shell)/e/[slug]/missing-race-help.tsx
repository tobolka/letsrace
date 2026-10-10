"use client";

import { usePathname } from "next/navigation";
import { NotFoundHelp, notFoundCopy } from "@/components/browse/not-found-help";
import type { Locale } from "@/lib/i18n/messages";

/**
 * The search prefilled with the missing address's words. The slug is read in
 * the browser: a not-found boundary gets no params, and reading it from the
 * request on the server would make every race page dynamic.
 */
export function MissingRaceHelp({ locale }: { locale: Locale }) {
  const slug = decodeURIComponent(usePathname().split("/").filter(Boolean).pop() ?? "");
  // The name's words, without the year or date (see `parseRaceSlug`).
  const query = slug
    .toLowerCase()
    .split("-")
    .filter((w) => w && !/^\d+$/.test(w))
    .join(" ");
  const c = notFoundCopy[locale];
  return <NotFoundHelp locale={locale} title={c.raceTitle} body={c.raceBody} query={query} />;
}
