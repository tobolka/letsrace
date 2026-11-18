import Link from "next/link";
import { DOC_WIDTH, PageHeader } from "@/components/account/panel";
import type { Locale } from "@/lib/i18n/messages";
import { LEGAL_CONTACT, LEGAL_PAGES, LEGAL_TITLES, type LegalPage } from "@/lib/legal";

export type LegalSection = { id?: string; h: string; p: string[] };

export type LegalDocument = {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
};

/** The other legal pages and About, linked under each one and from About. */
export function LegalLinks({ locale, current }: { locale: Locale; current?: LegalPage }) {
  const titles = LEGAL_TITLES[locale];
  const pages = LEGAL_PAGES.filter((p) => p !== current);
  return (
    <>
      {pages.map((page, i) => (
        <span key={page}>
          {i > 0 ? " · " : null}
          <Link href={`/${locale}/${page}`} className="underline underline-offset-2 hover:text-foreground">
            {titles[page]}
          </Link>
        </span>
      ))}
    </>
  );
}

export function LegalDoc({
  doc,
  locale,
  page,
  updatedOn,
}: {
  doc: LegalDocument;
  locale: Locale;
  page: LegalPage;
  updatedOn: string;
}) {
  return (
    <article className="p-4 md:p-8">
      <div className={DOC_WIDTH}>
        <PageHeader title={doc.title} description={doc.intro} />
        {doc.sections.map((s) => (
          <section key={s.h} id={s.id} className="flex scroll-mt-20 flex-col gap-2">
            <h2 className="text-base font-semibold">{s.h}</h2>
            {s.p.map((p) => (
              <p key={p} className="text-sm leading-relaxed text-pretty text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
        <p className="border-t pt-5 text-xs text-muted-foreground">
          {doc.updated}: {updatedOn} ·{" "}
          <a href={`mailto:${LEGAL_CONTACT}`} className="underline underline-offset-2 hover:text-foreground">
            {LEGAL_CONTACT}
          </a>{" "}
          · <LegalLinks locale={locale} current={page} /> ·{" "}
          <Link href={`/${locale}/about`} className="underline underline-offset-2 hover:text-foreground">
            {LEGAL_TITLES[locale].about}
          </Link>
        </p>
      </div>
    </article>
  );
}
