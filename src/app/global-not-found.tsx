import { headers } from "next/headers";
import { BrowseHeader } from "@/components/browse/browse-ui";
import { NotFoundHelp, notFoundCopy } from "@/components/browse/not-found-help";
import { asLocale } from "@/lib/i18n/messages";
import { RootDocument, rootMetadata } from "@/components/shell/root-document";

export const metadata = { ...rootMetadata, robots: { index: false, follow: true } };

/**
 * An address no route matches, or a language we do not publish. It bypasses
 * every layout, so it brings its own document. Never cached, so it can still
 * read the language the proxy found in the address.
 */
export default async function GlobalNotFound() {
  const locale = asLocale((await headers()).get("x-locale") ?? "");
  const c = notFoundCopy[locale];
  return (
    <RootDocument lang={locale}>
      <main className="relative min-h-full bg-background">
        <BrowseHeader locale={locale} crumbs={[]} />
        <NotFoundHelp locale={locale} title={c.pageTitle} body={c.pageBody} />
      </main>
    </RootDocument>
  );
}
