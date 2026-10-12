import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/messages";

const copy = {
  en: { label: "Race list pages", previous: "Previous", next: "Next", page: "Page" },
  cs: { label: "Stránky seznamu závodů", previous: "Předchozí", next: "Další", page: "Stránka" },
  sk: { label: "Stránky zoznamu pretekov", previous: "Predchádzajúca", next: "Ďalšia", page: "Stránka" },
  pl: { label: "Strony listy wyścigów", previous: "Poprzednia", next: "Następna", page: "Strona" },
  de: { label: "Seiten der Rennliste", previous: "Zurück", next: "Weiter", page: "Seite" },
};

/** Real links keep every race reachable for people and crawlers. */
export function RaceListPagination({ page, pages, path, locale }: { page: number; pages: number; path: string; locale: Locale }) {
  if (pages <= 1) return null;
  const t = copy[locale];
  const href = (n: number) => n === 1 ? path : `${path}?page=${n}`;
  return (
    <nav aria-label={t.label} className="mt-4 flex flex-wrap items-center justify-between gap-3">
      {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={href(page - 1)} rel="prev">{t.previous}</Link></Button> : <span />}
      <span className="text-sm text-muted-foreground tabular-nums">{t.page} {page} / {pages}</span>
      {page < pages ? <Button asChild variant="outline" size="sm"><Link href={href(page + 1)} rel="next">{t.next}</Link></Button> : <span />}
    </nav>
  );
}
