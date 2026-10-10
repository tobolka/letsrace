import { locale as rootLocale } from "next/root-params";
import { BrowseHeader } from "@/components/browse/browse-ui";
import { NotFoundHelp, notFoundCopy } from "@/components/browse/not-found-help";
import { asLocale } from "@/lib/i18n/messages";

/**
 * A page the site has no record for — a series, country or discipline — in the
 * reader's language, with ways on. The language is the route's own, so this
 * can render inside a cached page without reading the request.
 */
export default async function NotFound() {
  const locale = asLocale((await rootLocale()) ?? "");
  const c = notFoundCopy[locale];
  return (
    <main className="relative min-h-full bg-background">
      <BrowseHeader locale={locale} crumbs={[]} />
      <NotFoundHelp locale={locale} title={c.pageTitle} body={c.pageBody} />
    </main>
  );
}
