import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { BrandBar } from "@/components/shell/section-header";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { DISCIPLINE_FAMILY_ICONS, familyColor } from "@/lib/map-visuals";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/** The existing OG photograph is an accent on the browse entry, not event imagery. */
export function BrowseIntro({ title, description, photograph = false, children }: {
  title: string;
  description: string;
  photograph?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("browse-intro", photograph && "browse-intro-with-image")}>
      <div className="min-w-0 py-1">
        <span className="race-ribbon mb-4 block" aria-hidden />
        <h1 className="text-balance text-3xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-[2.125rem]">{title}</h1>
        <p className="mt-3 max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
      {photograph ? (
        <div className="browse-intro-photo" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/riding/mtb.webp" alt="" width={720} height={480} decoding="async" className="h-full w-full object-cover" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The top of every browse page — countries, disciplines, series, a race — the
 * same on each: the logo in the bar the map has, and the trail back up.
 */
export function BrowseHeader({ locale, crumbs }: { locale: string; crumbs: Crumb[] }) {
  return (
    <>
      <BrandBar href={`/${locale}`} />
      {crumbs.length ? (
        <Breadcrumb className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6">
          <BreadcrumbList>
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <Fragment key={`${c.label}-${i}`}>
                  <BreadcrumbItem className={cn(last && "min-w-0")}>
                    {last || !c.href ? (
                      <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={c.href}>{c.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {last ? null : <BreadcrumbSeparator />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
    </>
  );
}

/** A section of tiles with its heading. */
export function TileGrid({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title ? <h2 className="browse-section-title mb-3 text-base font-semibold tracking-tight">{title}</h2> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </section>
  );
}

const TILE =
  "browse-tile group flex items-center gap-3 rounded-xl border bg-card p-4 transition-[background-color,border-color] duration-150 hover:border-brand/30 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 motion-reduce:transition-none";

function TileText({ name, count }: { name: string; count: string }) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold leading-tight">{name}</span>
        <span className="mt-1 text-xs text-muted-foreground tabular-nums">{count}</span>
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 group-hover:text-brand" aria-hidden />
    </>
  );
}

/** A country: its flag, its name and how many races it has coming. */
export function CountryCard({ href, code, name, count }: { href: string; code: string; name: string; count: string }) {
  return (
    <Link href={href} className={TILE}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/70">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/flags/${code.toLowerCase()}.svg`}
          alt=""
          width={28}
          height={21}
          className="h-[21px] w-7 rounded-[3px] object-cover ring-1 ring-black/5"
        />
      </span>
      <TileText name={name} count={count} />
    </Link>
  );
}

/** A discipline: the glyph the map's pins wear, on its colour. */
export function DisciplineTile({ href, family, name, count }: { href: string; family: string; name: string; count: string }) {
  const icon = DISCIPLINE_FAMILY_ICONS[family];
  const color = familyColor(family);
  return (
    <Link href={href} className={TILE}>
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: color }}>
        {icon ? (
          // The pin glyphs are black on transparent; inverted they read on the colour.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" width={22} height={22} className="size-[22px] invert" />
        ) : null}
      </span>
      <TileText name={name} count={count} />
    </Link>
  );
}

/** A series: its name, how many rounds, when the next one is. */
export function SeriesCard({ href, name, meta }: { href: string; name: string; meta: string }) {
  return (
    <Link href={href} className={TILE}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-[15px] font-semibold leading-tight">{name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{meta}</span>
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 group-hover:text-brand" aria-hidden />
    </Link>
  );
}

/*
 * Stand-ins while a browse page loads: the same bar, trail, measure and
 * shapes as the page itself, so nothing jumps when it arrives.
 */

export function BrowseHeaderSkeleton({ depth = 2 }: { depth?: number }) {
  return (
    <>
      <div className="flex h-12 shrink-0 items-center border-b px-4">
        <BrandMark size="xs" />
      </div>
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 pt-4 sm:px-6">
        {Array.from({ length: depth }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>
    </>
  );
}

export function PageIntroSkeleton({ button = true, branded = false, photograph = false }: { button?: boolean; branded?: boolean; photograph?: boolean }) {
  const text = (
    <div className={cn(branded && "min-w-0 py-1")}>
      {branded ? <span className="race-ribbon mb-4 block" aria-hidden /> : null}
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <Skeleton className="mt-2 h-4 w-2/3 max-w-sm" />
      {button ? <Skeleton className="mt-5 h-9 w-40 rounded-md" /> : null}
    </div>
  );
  if (!branded) return text;
  return (
    <div className={cn("browse-intro", photograph && "browse-intro-with-image")}>
      {text}
      {photograph ? <Skeleton className="browse-intro-photo border-b-0" /> : null}
    </div>
  );
}

export function TileGridSkeleton({ count = 6, icon = true, className }: { count?: number; icon?: boolean; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="browse-tile flex items-center gap-3 rounded-xl border bg-card p-4">
          {icon ? <Skeleton className="size-10 shrink-0 rounded-lg" /> : null}
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RaceListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={className}>
      <Skeleton className="mb-2 h-4 w-24" />
      <div className="overflow-hidden rounded-xl border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-full max-w-xs" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
