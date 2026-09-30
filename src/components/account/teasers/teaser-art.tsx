import { BellRing, CalendarCheck2, Check, MapPin, Mountain } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DISCIPLINE_FAMILY_COLORS as C } from "@/lib/map-visuals";
import type { TeaserKey, teaserMessagesFor } from "@/lib/i18n/teasers";
import { cn } from "@/lib/utils";

type Art = ReturnType<typeof teaserMessagesFor>["art"];

/**
 * The illustrations are the product, drawn small.
 *
 * Built from the same cards, badges and avatars the signed-in pages use, so
 * the picture is an honest preview of what signing in gets you rather than a
 * stock drawing of somebody on a bike. They are decoration: hidden from
 * assistive technology, which gets the same promise in the copy beside them.
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
      className="relative isolate aspect-[5/4] w-full overflow-hidden rounded-3xl border bg-muted/60 select-none"
    >
      {/* A contour map, faint, so the stage reads as terrain rather than a box. */}
      <svg className="absolute inset-0 -z-10 size-full text-border" viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <path
            key={i}
            d={`M-20 ${60 + i * 38} C 80 ${20 + i * 38}, 160 ${110 + i * 38}, 250 ${60 + i * 38} S 380 ${30 + i * 38}, 440 ${80 + i * 38}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          />
        ))}
      </svg>
      {kind === "plan" ? <PlanArt art={art} weekdays={weekdays} month={month} /> : null}
      {kind === "discover" ? <DiscoverArt art={art} /> : null}
      {kind === "riders" ? <RidersArt art={art} /> : null}
    </div>
  );
}

const float = "absolute shadow-[0_12px_40px_-12px_rgba(28,25,23,.28)]";

function PlanArt({ art, weekdays, month }: { art: Art; weekdays: string[]; month: string }) {
  // A month with races on its weekends: the dots are the season, filling up.
  const dots: Record<number, string[]> = {
    5: [C.mtb], 6: [C.mtb, C.road], 12: [C.gravel], 13: [C.mtb],
    19: [C.cx], 20: [C.mtb, C.cx], 27: [C.road],
  };
  return (
    <>
      <Card className={cn(float, "top-[9%] left-[7%] w-[62%] gap-0 -rotate-2 py-0")}>
        <CardContent className="p-3">
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
              const weekend = i % 7 >= 5;
              return (
                <span
                  key={day}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-md py-0.5 tabular-nums",
                    weekend && "bg-muted",
                    day === 13 && "bg-foreground text-background",
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

      <Card className={cn(float, "right-[6%] bottom-[10%] w-[52%] gap-0 rotate-2 py-0")}>
        <CardContent className="flex flex-col gap-2.5 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {art.nextRace}
            </span>
            <Badge className="bg-brand text-[10px] text-white">{art.inDays(12)}</Badge>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-8 w-[3px] rounded-full" style={{ background: C.mtb }} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Bike Cup Beskydy</p>
              <p className="text-[11px] text-muted-foreground">Frenštát pod Radhoštěm · XCO</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Check className="size-3 text-emerald-600" /> {art.registered}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
              <span className="size-2 rounded-full border border-current" /> {art.paid}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <span className={cn(float, "top-[12%] right-[9%] flex size-11 items-center justify-center rounded-2xl bg-card")}>
        <CalendarCheck2 className="size-5 text-brand" />
      </span>
    </>
  );
}

function DiscoverArt({ art }: { art: Art }) {
  return (
    <>
      {/* The watched circle around home, with races dropping into it. */}
      <div className="absolute top-1/2 left-[30%] size-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-brand/30 bg-brand/5" />
      <span className="absolute top-1/2 left-[30%] flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-background shadow-lg">
        <MapPin className="size-4" />
      </span>
      {[
        { top: "24%", left: "18%", c: C.mtb },
        { top: "66%", left: "40%", c: C.gravel },
        { top: "38%", left: "47%", c: C.cx },
      ].map((p, i) => (
        <span
          key={i}
          className="absolute size-3.5 rounded-full border-2 border-card shadow"
          style={{ top: p.top, left: p.left, background: p.c }}
        />
      ))}

      <Card className={cn(float, "top-[12%] right-[6%] w-[54%] gap-0 py-0 opacity-70 blur-[0.3px]")}>
        <CardContent className="flex items-center gap-2 p-2.5">
          <span className="size-2 rounded-full" style={{ background: C.cx }} />
          <span className="truncate text-[11px] text-muted-foreground">Cyklokros Kolín · 9 km</span>
        </CardContent>
      </Card>
      <Card className={cn(float, "top-[30%] right-[4%] w-[60%] gap-0 py-0")}>
        <CardContent className="flex flex-col gap-2 p-3.5">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-brand">
              <BellRing className="size-3.5" />
            </span>
            <span className="text-[11px] font-medium">{art.newRace}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-8 w-[3px] rounded-full" style={{ background: C.mtb }} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Jizerský MTB pohár</p>
              <p className="text-[11px] text-muted-foreground">{art.kmAway(18)}</p>
            </div>
          </div>
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
      <div className="absolute top-[10%] left-[7%] flex w-[48%] flex-col gap-2">
        {riders.map((r, idx) => (
          <Card
            key={r.i}
            className={cn(float, "relative gap-0 py-0")}
            style={{ transform: `translateX(${idx * 10}px)` }}
          >
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

      <Card className={cn(float, "right-[6%] bottom-[9%] w-[54%] gap-0 rotate-1 py-0")}>
        <CardContent className="flex flex-col gap-3 p-3.5">
          <div className="flex items-start gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Mountain className="size-4" style={{ color: C.mtb }} />
            </span>
            <div className="min-w-0">
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
