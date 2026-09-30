import type { CSSProperties } from "react";
import { BellRing, CalendarCheck2, Check, MapPin, Mountain } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DISCIPLINE_FAMILY_COLORS as C } from "@/lib/map-visuals";
import type { TeaserKey, teaserMessagesFor } from "@/lib/i18n/teasers";
import { cn } from "@/lib/utils";

type Art = ReturnType<typeof teaserMessagesFor>["art"];

/** Each card rises in a beat after the last one. */
const rise = (i: number): CSSProperties => ({ animationDelay: `${120 + i * 140}ms, ${900 + i * 700}ms` });

/**
 * The product, drawn small: the same cards, badges and avatars the signed-in
 * pages use, laid on a plain grey ground. Decoration only — the copy under it
 * makes the same promise to a screen reader.
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
      className="relative flex h-72 w-full items-center justify-center overflow-hidden rounded-2xl bg-muted/50 select-none sm:h-80 md:aspect-[5/4] md:h-auto"
    >
      {/* The cards a size down, so they sit in the grey with air around them. */}
      <div className="absolute inset-0 scale-[0.85]">
        {kind === "plan" ? <PlanArt art={art} weekdays={weekdays} month={month} /> : null}
        {kind === "discover" ? <DiscoverArt art={art} /> : null}
        {kind === "riders" ? <RidersArt art={art} /> : null}
      </div>
    </div>
  );
}

const card = "teaser-rise absolute gap-0 py-0";

function RaceLine({ name, meta, color }: { name: string; meta: string; color: string }) {
  return (
    <div className="flex items-start gap-2 text-left">
      <span className="mt-0.5 h-8 w-[3px] shrink-0 rounded-full" style={{ background: color }} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

function PlanArt({ art, weekdays, month }: { art: Art; weekdays: string[]; month: string }) {
  const dots: Record<number, string[]> = {
    5: [C.mtb], 6: [C.mtb, C.road], 12: [C.gravel], 13: [C.mtb], 19: [C.cx], 20: [C.mtb, C.cx], 27: [C.road],
  };
  return (
    <>
      <Card className={cn(card, "left-1/2 top-8 w-64 -translate-x-[70%]")} style={rise(0)}>
        <CardContent className="p-3">
          <p className="mb-2 text-left text-xs font-semibold capitalize">{month}</p>
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
                      <span key={j} className="size-1 rounded-full" style={{ background: c }} />
                    ))}
                  </span>
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Card className={cn(card, "left-1/2 bottom-8 w-60 -translate-x-[15%]")} style={rise(1)}>
        <CardContent className="flex flex-col gap-2.5 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <CalendarCheck2 className="size-3.5 text-brand" />
              {art.nextRace}
            </span>
            <Badge className="bg-brand text-[10px] text-white">{art.inDays(12)}</Badge>
          </div>
          <RaceLine name="Bike Cup Beskydy" meta="Frenštát pod Radhoštěm · XCO" color={C.mtb} />
          <div className="flex gap-1.5">
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Check className="size-3 text-emerald-600" /> {art.registered}
            </Badge>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">{art.paid}</Badge>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function DiscoverArt({ art }: { art: Art }) {
  return (
    <>
      {/* The watched circle, breathing, with races dropping into it. */}
      <div className="absolute left-1/2 top-1/2 size-56 -translate-x-[78%] -translate-y-1/2">
        <span className="teaser-pulse absolute inset-0 rounded-full bg-brand/15" />
        <span className="absolute inset-0 rounded-full border-2 border-dashed border-brand/30 bg-brand/5" />
        <span className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <MapPin className="size-4" />
        </span>
        {[
          { top: "18%", left: "22%", c: C.mtb },
          { top: "70%", left: "34%", c: C.gravel },
          { top: "36%", left: "76%", c: C.cx },
        ].map((p, i) => (
          <span
            key={i}
            className="teaser-rise absolute size-3.5 rounded-full border-2 border-background"
            style={{ top: p.top, left: p.left, background: p.c, ...rise(i + 1) }}
          />
        ))}
      </div>
      <Card className={cn(card, "left-1/2 top-1/2 w-60 -translate-y-1/2")} style={rise(2)}>
        <CardContent className="flex flex-col gap-2.5 p-3.5">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-brand">
              <BellRing className="size-3.5" />
            </span>
            <span className="text-[11px] font-medium">{art.newRace}</span>
          </div>
          <RaceLine name="Jizerský MTB pohár" meta={art.kmAway(18)} color={C.mtb} />
          <Badge variant="secondary" className="w-fit text-[10px]">{art.matches}</Badge>
        </CardContent>
      </Card>
    </>
  );
}

function RidersArt({ art }: { art: Art }) {
  const riders = [
    { i: "EN", n: "Ema", cat: "U11", bg: "bg-rose-100 text-rose-900" },
    { i: "JN", n: "Jakub", cat: "U15", bg: "bg-sky-100 text-sky-900" },
    { i: "PN", n: "Petr", cat: "Masters", bg: "bg-amber-100 text-amber-900" },
  ];
  return (
    <>
      <div className="absolute left-1/2 top-1/2 flex w-52 -translate-x-[105%] -translate-y-1/2 flex-col gap-2">
        {riders.map((r, i) => (
          <Card key={r.i} className="teaser-rise gap-0 py-0" style={rise(i)}>
            <CardContent className="flex items-center gap-2.5 p-2.5">
              <Avatar className="size-8">
                <AvatarFallback className={cn("text-[11px] font-semibold", r.bg)}>{r.i}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{r.n}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">{r.cat}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className={cn(card, "left-1/2 top-1/2 w-56 translate-x-[5%] -translate-y-1/2")} style={rise(3)}>
        <CardContent className="flex flex-col gap-3 p-3.5">
          <div className="flex items-start gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Mountain className="size-4" style={{ color: C.mtb }} />
            </span>
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold">Dětský MTB Cup</p>
              <p className="text-[11px] text-muted-foreground">Hradec Králové · XCO</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {riders.slice(0, 2).map((r) => (
                <Avatar key={r.i} className="size-6 ring-2 ring-card">
                  <AvatarFallback className={cn("text-[9px] font-semibold", r.bg)}>{r.i}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">2 {art.going}</span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
