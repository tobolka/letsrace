import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
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

/**
 * The top of every browse page — countries, disciplines, series, a race — the
 * same on each: the logo in the bar the map has, and the trail back up.
 */
export function BrowseHeader({ locale, crumbs }: { locale: string; crumbs: Crumb[] }) {
  return (
    <>
      <div className="flex h-12 shrink-0 items-center border-b px-4">
        <BrandMark href={`/${locale}`} size="xs" />
      </div>
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
      {title ? <h2 className="mb-3 text-lg font-semibold">{title}</h2> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </section>
  );
}

/** A country: its flag, its name and how many races it has coming. */
export function CountryCard({ href, flag, name, count }: { href: string; flag: string; name: string; count: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/25 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span aria-hidden className="text-4xl leading-none">
        {flag}
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="font-semibold leading-tight">{name}</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
      <span className="-mt-2 text-sm text-muted-foreground tabular-nums">{count}</span>
    </Link>
  );
}

/** A discipline: the glyph the map's pins wear, on its colour. */
export function DisciplineTile({ href, family, name, count }: { href: string; family: string; name: string; count: string }) {
  const icon = DISCIPLINE_FAMILY_ICONS[family];
  const color = familyColor(family);
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/25 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span
        aria-hidden
        className="flex size-11 items-center justify-center rounded-full"
        style={{ backgroundColor: color }}
      >
        {icon ? (
          // The pin glyphs are black on transparent; inverted they read on the colour.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" width={24} height={24} className="size-6 invert" />
        ) : null}
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="font-semibold leading-tight">{name}</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
      <span className="-mt-2 text-sm text-muted-foreground tabular-nums">{count}</span>
    </Link>
  );
}

/** A series: its name, how many rounds, when the next one is. */
export function SeriesCard({ href, name, meta }: { href: string; name: string; meta: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/25 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 font-semibold leading-tight">{name}</span>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
      <span className="text-sm text-muted-foreground tabular-nums">{meta}</span>
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

export function PageIntroSkeleton({ button = true }: { button?: boolean }) {
  return (
    <>
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <Skeleton className="mt-2 h-4 w-2/3 max-w-sm" />
      {button ? <Skeleton className="mt-5 h-9 w-40 rounded-md" /> : null}
    </>
  );
}

export function TileGridSkeleton({ count = 6, icon = true, className }: { count?: number; icon?: boolean; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          {icon ? <Skeleton className="size-11 rounded-full" /> : null}
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
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
