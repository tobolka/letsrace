import { headers } from "next/headers";
import { BrowseHeader } from "@/components/browse/browse-ui";
import { NotFoundHelp, notFoundCopy } from "@/components/browse/not-found-help";
import { asLocale } from "@/lib/i18n/messages";

/** Any address the site has no page for: in the reader's language, with ways on. */
export default async function NotFound() {
  // The proxy names the address's language; the root layout reads it the same way.
  const locale = asLocale((await headers()).get("x-locale") ?? "");
  const c = notFoundCopy[locale];
  return (
    <main className="relative min-h-full bg-background">
      <BrowseHeader locale={locale} crumbs={[]} />
      <NotFoundHelp locale={locale} title={c.pageTitle} body={c.pageBody} />
    </main>
  );
}
