import Link from "next/link";
import { CalendarDays, Globe2, Map as MapIcon, Search, Sun } from "lucide-react";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

export const notFoundCopy: Record<
  Locale,
  {
    raceTitle: string;
    raceBody: string;
    pageTitle: string;
    pageBody: string;
    near: string;
    search: string;
    searchLabel: string;
    next: string;
    map: string;
    weekend: string;
    calendar: string;
    browse: string;
  }
> = {
  en: {
    raceTitle: "We could not find this race",
    raceBody: "The link may be old, or the race has since changed its name or date.",
    pageTitle: "This page does not exist",
    pageBody: "The address may be mistyped or out of date.",
    near: "Did you mean",
    search: "Search",
    searchLabel: "Search races by name or place",
    next: "Or carry on from here",
    map: "Race map",
    weekend: "This weekend",
    calendar: "Calendar",
    browse: "Races by country",
  },
  cs: {
    raceTitle: "Tenhle závod jsme nenašli",
    raceBody: "Odkaz je možná starý, nebo závod mezitím změnil název či datum.",
    pageTitle: "Tahle stránka neexistuje",
    pageBody: "Adresa je možná překlepnutá nebo zastaralá.",
    near: "Možná hledáš",
    search: "Hledat",
    searchLabel: "Hledat závod podle názvu nebo místa",
    next: "Nebo pokračuj odsud",
    map: "Mapa závodů",
    weekend: "Tento víkend",
    calendar: "Kalendář",
    browse: "Závody podle zemí",
  },
  pl: {
    raceTitle: "Nie znaleźliśmy tego wyścigu",
    raceBody: "Link może być nieaktualny albo wyścig zmienił nazwę lub datę.",
    pageTitle: "Ta strona nie istnieje",
    pageBody: "Adres może zawierać literówkę albo być nieaktualny.",
    near: "Może chodzi o",
    search: "Szukaj",
    searchLabel: "Szukaj wyścigu po nazwie lub miejscu",
    next: "Albo przejdź dalej",
    map: "Mapa wyścigów",
    weekend: "Ten weekend",
    calendar: "Kalendarz",
    browse: "Wyścigi według krajów",
  },
  sk: {
    raceTitle: "Tento pretek sme nenašli",
    raceBody: "Odkaz je možno starý, alebo pretek medzitým zmenil názov či dátum.",
    pageTitle: "Táto stránka neexistuje",
    pageBody: "Adresa je možno preklepnutá alebo zastaraná.",
    near: "Možno hľadáš",
    search: "Hľadať",
    searchLabel: "Hľadať pretek podľa názvu alebo miesta",
    next: "Alebo pokračuj odtiaľto",
    map: "Mapa pretekov",
    weekend: "Tento víkend",
    calendar: "Kalendár",
    browse: "Preteky podľa krajín",
  },
  de: {
    raceTitle: "Dieses Rennen haben wir nicht gefunden",
    raceBody: "Der Link ist vielleicht veraltet, oder Name oder Datum des Rennens haben sich geändert.",
    pageTitle: "Diese Seite gibt es nicht",
    pageBody: "Die Adresse ist vielleicht vertippt oder veraltet.",
    near: "Meintest du",
    search: "Suchen",
    searchLabel: "Rennen nach Name oder Ort suchen",
    next: "Oder weiter von hier",
    map: "Rennkarte",
    weekend: "Dieses Wochenende",
    calendar: "Kalender",
    browse: "Rennen nach Land",
  },
};

/**
 * A missing page that is not a dead end: say what probably happened, offer
 * the races the address may have meant, a search already filled in with its
 * words, and the ways into the site a reader most often wants next.
 */
export function NotFoundHelp({
  locale,
  title,
  body,
  query = "",
  children,
}: {
  locale: Locale;
  title: string;
  body: string;
  /** The address's words, ready to search for. */
  query?: string;
  /** Races the address may have meant. */
  children?: ReactNode;
}) {
  const c = notFoundCopy[locale];
  const ways = [
    { href: `/${locale}`, label: c.map, icon: <MapIcon data-icon="inline-start" /> },
    { href: localePath(locale, "collections/weekend"), label: c.weekend, icon: <Sun data-icon="inline-start" /> },
    { href: localePath(locale, "schedule"), label: c.calendar, icon: <CalendarDays data-icon="inline-start" /> },
    { href: localePath(locale, "c"), label: c.browse, icon: <Globe2 data-icon="inline-start" /> },
  ];
  return (
    <div className="relative mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
      <header className="browse-intro">
        <h1 data-page-title className="text-balance text-3xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-[2.125rem]">
          {title}
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-sm text-muted-foreground">{body}</p>
      </header>

      {/* A plain GET form: the map reads `?q=` and searches, with or without JS. */}
      <form action={`/${locale}`} method="get" role="search" className="mt-6 max-w-xl">
        <InputGroup className="h-11">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            name="q"
            type="search"
            defaultValue={query}
            aria-label={c.searchLabel}
            placeholder={c.searchLabel}
            minLength={2}
            required
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" variant="default" size="sm">
              {c.search}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>

      {children ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">{c.near}</h2>
          {children}
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">{c.next}</h2>
        <div className="flex flex-wrap gap-2">
          {ways.map((w) => (
            <Button key={w.href} asChild variant="outline">
              <Link href={w.href}>
                {w.icon}
                {w.label}
              </Link>
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
