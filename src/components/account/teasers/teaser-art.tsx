import type { CSSProperties, ReactNode } from "react";
import { BellRing, CalendarCheck2, Check, MapPin, Mountain } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DISCIPLINE_FAMILY_COLORS as C } from "@/lib/map-visuals";
import type { TeaserKey, teaserMessagesFor } from "@/lib/i18n/teasers";
import { cn } from "@/lib/utils";

type Art = ReturnType<typeof teaserMessagesFor>["art"];

/** Start an animation `ms` in — and, for rising cards, offset its drift too. */
const at = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms, ${ms + 1000}ms` });
const after = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/**
 * The product, drawn small and brought to life.
 *
 * Each picture is a fixed 400×300 composition built from the app's own cards,
 * badges and avatars, scaled to whatever width the page gives it — so nothing
 * is ever cropped and the pieces keep their places. The ground is the plain
 * grey of the palette with a faint dot grid fading out from the middle.
 * Decoration only: the copy beside it makes the same promise to a screen
 * reader.
 */
export function TeaserArt({
  kind,
  art,
  weekdays,
  month,
}: {
  kind: TeaserKey;
  art: Art;
  weekdays: string[];
  month: string;
}) {
  return (
    <div
      aria-hidden
      className="@container relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-muted/40 select-none"
    >
      <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)] [background-size:14px_14px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,var(--background)_0%,transparent_65%)] opacity-70" />
      <div className="absolute top-1/2 left-1/2 h-[300px] w-[400px] -translate-x-1/2 -translate-y-1/2 scale-[0.7] @[340px]:scale-[0.85] @[420px]:scale-100 @[520px]:scale-[1.12]">
        {kind === "plan" ? <PlanArt art={art} weekdays={weekdays} month={month} /> : null}
        {kind === "discover" ? <DiscoverArt art={art} /> : null}
        {kind === "riders" ? <RidersArt art={art} /> : null}
      </div>
    </div>
  );
}

/** A card of the illustration: the app's card, lifted by a soft layered shadow. */
function Float({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div
      className={cn(
        "teaser-rise absolute rounded-xl border bg-card text-left",
        "shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_5%,transparent),0_14px_36px_-14px_color-mix(in_oklch,var(--foreground)_22%,transparent)]",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

function RaceLine({ name, meta, color }: { name: string; meta: string; color: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 h-8 w-[3px] shrink-0 rounded-full" style={{ background: color }} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold">{name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

const TINT = ["bg-rose-100 text-rose-900", "bg-sky-100 text-sky-900", "bg-amber-100 text-amber-900"];

function PlanArt({ art, weekdays, month }: { art: Art; weekdays: string[]; month: string }) {
  const dots: Record<number, string[]> = {
    5: [C.mtb], 6: [C.mtb, C.road], 12: [C.gravel], 13: [C.mtb], 19: [C.cx], 20: [C.mtb, C.cx], 27: [C.road],
  };
  let n = 0;
  return (
    <>
      <Float className="top-4 left-3 w-[250px] p-3" style={at(100)}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold capitalize">{month}</span>
          <span className="flex gap-1">
            <span className="size-1.5 rounded-full bg-border" />
            <span className="size-1.5 rounded-full bg-border" />
          </span>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center text-[9px] text-muted-foreground">
          {weekdays.map((d, i) => (
            <span key={i} className="font-medium uppercase">{d}</span>
          ))}
          {Array.from({ length: 28 }, (_, i) => {
            const day = i + 1;
            return (
              <span
                key={day}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md py-0.5 tabular-nums",
                  i % 7 >= 5 && "bg-muted",
                  day === 13 && "bg-primary text-primary-foreground",
                )}
              >
                {day}
                <span className="flex h-1 gap-0.5">
                  {(dots[day] ?? []).map((c, j) => (
                    <span key={j} className="teaser-pop size-1 rounded-full" style={{ background: c, ...after(700 + n++ * 110) }} />
                  ))}
                </span>
              </span>
            );
          })}
        </div>
      </Float>

      <Float className="right-3 bottom-4 w-[222px] p-3.5" style={at(380)}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            <CalendarCheck2 className="size-3.5 text-brand" />
            {art.nextRace}
          </span>
          <Badge className="bg-brand text-[10px] text-white">{art.inDays(12)}</Badge>
        </div>
        <div className="mt-2.5">
          <RaceLine name={art.planRace.name} meta={art.planRace.meta} color={C.mtb} />
        </div>
        <div className="mt-3 flex gap-1.5">
          <Badge className="gap-1 bg-primary text-[10px] text-primary-foreground">
            <Check className="size-3" /> {art.registered}
          </Badge>
          {/* Paid arrives a beat later — the one thing on the card that changes. */}
          <span className="relative inline-flex">
            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
              <span className="size-2.5 rounded-full border border-current" /> {art.paid}
            </Badge>
            <Badge className="teaser-fill absolute inset-0 gap-1 bg-primary text-[10px] text-primary-foreground" style={after(2300)}>
              <Check className="size-3" /> {art.paid}
            </Badge>
          </span>
        </div>
      </Float>

      <Float className="top-6 right-6 flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5" style={at(1500)}>
        <span className="flex -space-x-1.5">
          {art.riders.slice(0, 2).map((n) => n.slice(0, 1)).map((i, k) => (
            <Avatar key={i} className="size-6 ring-2 ring-card">
              <AvatarFallback className={cn("text-[10px] font-semibold", TINT[k])}>{i}</AvatarFallback>
            </Avatar>
          ))}
        </span>
        <span className="text-[11px] font-medium">2 {art.going}</span>
      </Float>
    </>
  );
}

function DiscoverArt({ art }: { art: Art }) {
  const pins = [
    { x: 58, y: 70, c: C.mtb, d: 900 },
    { x: 172, y: 196, c: C.gravel, d: 1300 },
    { x: 196, y: 92, c: C.cx, d: 1700 },
    { x: 84, y: 186, c: C.road, d: 2100 },
  ];
  return (
    <>
      {/* The watched circle: rings, a radar sweep, and races dropping in. */}
      <div className="absolute top-[45px] left-[18px] size-[210px]">
        <span className="teaser-pulse absolute inset-0 rounded-full bg-brand/15" />
        <span className="absolute inset-0 rounded-full border-2 border-dashed border-brand/35 bg-brand/[0.04]" />
        <span className="absolute inset-[30%] rounded-full border border-brand/20" />
        <span className="teaser-sweep absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,color-mix(in_oklch,var(--brand)_28%,transparent)_50deg,transparent_70deg)]" />
        <span className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
          <MapPin className="size-4" />
        </span>
        {pins.map((p, i) => (
          <span
            key={i}
            className="teaser-pop absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background"
            style={{ left: p.x, top: p.y, background: p.c, ...after(p.d) }}
          />
        ))}
      </div>

      {/* A stack of notifications: the newest in front, older ones behind. */}
      <Float className="top-[62px] right-[22px] w-[178px] scale-[0.9] p-3 opacity-60" style={at(500)}>
        <div className="h-2 w-24 rounded bg-muted" />
        <div className="mt-2 h-2 w-16 rounded bg-muted" />
      </Float>
      <Float className="top-[84px] right-3 w-[196px] p-3.5" style={at(800)}>
        <div className="flex items-center gap-2">
          <span className="teaser-ring flex size-7 items-center justify-center rounded-full bg-brand/10 text-brand">
            <BellRing className="size-3.5" />
          </span>
          <span className="text-[11px] font-medium">{art.newRace}</span>
        </div>
        <div className="mt-2.5">
          <RaceLine name={art.alertRace} meta={art.kmAway(18)} color={C.mtb} />
        </div>
        <Badge variant="secondary" className="mt-2.5 text-[10px]">{art.matches}</Badge>
      </Float>
    </>
  );
}

function RidersArt({ art }: { art: Art }) {
  const cats = ["U11", "U15", "Masters"];
  const riders = art.riders.map((n, k) => ({ i: n.slice(0, 1), n, cat: cats[k]! }));
  return (
    <>
      {riders.map((r, k) => (
        <Float key={r.n} className="left-4 flex w-[162px] items-center gap-2.5 p-2.5" style={{ top: 42 + k * 74, ...at(100 + k * 150) }}>
          <Avatar className="size-8">
            <AvatarFallback className={cn("text-[11px] font-semibold", TINT[k])}>{r.i}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{r.n}</span>
          <Badge variant="outline" className="ml-auto text-[10px]">{r.cat}</Badge>
        </Float>
      ))}

      {/* Who is going, drawn: a line from each rider to the race. */}
      <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 400 300" fill="none">
        {[
          { d: "M178 66 C 204 66, 204 138, 226 146", delay: 900 },
          { d: "M178 140 C 200 140, 206 150, 226 150", delay: 1150 },
        ].map((p, i) => (
          <g key={i}>
            <path
              d={p.d}
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset="1"
              className="teaser-draw stroke-brand/60"
              strokeWidth="1.5"
              strokeLinecap="round"
              style={after(p.delay)}
            />
            <circle cx="178" cy={i === 0 ? 66 : 140} r="3" className="teaser-pop fill-brand" style={after(p.delay - 100)} />
          </g>
        ))}
      </svg>

      <Float className="top-[104px] right-2 w-[172px] p-3.5" style={at(550)}>
        <div className="flex items-start gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Mountain className="size-4" style={{ color: C.mtb }} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{art.familyRace.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{art.familyRace.place}</p>
          </div>
        </div>
        <div className="teaser-fill mt-3 flex items-center gap-2" style={after(1900)}>
          <span className="flex -space-x-2">
            {riders.slice(0, 2).map((r, k) => (
              <Avatar key={r.n} className="size-6 ring-2 ring-card">
                <AvatarFallback className={cn("text-[10px] font-semibold", TINT[k])}>{r.i}</AvatarFallback>
              </Avatar>
            ))}
          </span>
          <span className="text-[11px] text-muted-foreground">2 {art.going}</span>
        </div>
      </Float>
    </>
  );
}
