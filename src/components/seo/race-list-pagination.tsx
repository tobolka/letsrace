import Link from "next/link";
import { Button } from "@/components/ui/button";
import { messagesFor, type Locale } from "@/lib/i18n/messages";

/** Real links keep every race reachable for people and crawlers. */
export function RaceListPagination({ page, pages, path, locale }: { page: number; pages: number; path: string; locale: Locale }) {
  if (pages <= 1) return null;
  const t = messagesFor(locale);
  const href = (n: number) => n === 1 ? path : `${path}?page=${n}`;
  return (
    <nav aria-label={t.racePagesLabel} className="mt-4 flex flex-wrap items-center justify-between gap-3">
      {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={href(page - 1)} rel="prev">{t.pagePrevious}</Link></Button> : <span />}
      <span className="text-sm text-muted-foreground tabular-nums">{t.pageWord} {page} / {pages}</span>
      {page < pages ? <Button asChild variant="outline" size="sm"><Link href={href(page + 1)} rel="next">{t.pageNext}</Link></Button> : <span />}
    </nav>
  );
}
