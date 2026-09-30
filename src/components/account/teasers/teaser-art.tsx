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
/**
 * Photographs for each teaser. Drop a file at `public/teasers/<kind>.webp` and
 * it replaces the fallback — the race photo the intro card uses — with no code
 * change: both are CSS backgrounds, and the second only shows where the first
 * is missing.
 */
const PHOTO: Record<TeaserKey, string> = {
  plan: "/teasers/plan.webp",
  discover: "/teasers/discover.webp",
  riders: "/teasers/riders.webp",
};

export function TeaserArt({
  kind,
  art,
}: {
  kind: TeaserKey;
  art: Art;
}) {
  return (
    <div
      aria-hidden
      className="relative isolate aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted bg-cover bg-center select-none"
      style={{ backgroundImage: `url(${PHOTO[kind]}), url(/intro-race@2x.webp)` }}
    >
      {/* Enough shade at the foot for the card to sit on, none at the top. */}
      <div className="absolute inset-0 -z-0 bg-gradient-to-t from-black/35 via-black/0 to-black/0" />
      <div className="absolute inset-x-4 bottom-4 flex justify-start sm:inset-x-6 sm:bottom-6">
        {kind === "plan" ? <PlanArt art={art} /> : null}
        {kind === "discover" ? <DiscoverArt art={art} /> : null}
        {kind === "riders" ? <RidersArt art={art} /> : null}
      </div>
    </div>
  );
}

const float = "relative w-full max-w-72 gap-0 border-0 py-0 shadow-[0_8px_24px_-8px_rgba(0,0,0,.35)]";

function PlanArt({ art }: { art: Art }) {
  return (
    <Card className={float}>
      <CardContent className="flex flex-col gap-2.5 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            <CalendarCheck2 className="size-3.5 text-brand" />
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
  );
}

function DiscoverArt({ art }: { art: Art }) {
  return (
    <Card className={float}>
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
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="size-3" /> {art.kmAway(18)}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="w-fit text-[10px]">{art.matches}</Badge>
      </CardContent>
    </Card>
  );
}

function RidersArt({ art }: { art: Art }) {
  const riders = [
    { i: "EN", cat: "U11", bg: "bg-rose-100 text-rose-900" },
    { i: "JN", cat: "U15", bg: "bg-sky-100 text-sky-900" },
  ];
  return (
    <Card className={float}>
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
            {riders.map((r) => (
              <Avatar key={r.i} className="size-6 ring-2 ring-card">
                <AvatarFallback className={cn("text-[9px] font-semibold", r.bg)}>{r.i}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">2 {art.going}</span>
          <span className="ml-auto flex gap-1">
            {riders.map((r) => (
              <Badge key={r.cat} variant="outline" className="text-[10px]">{r.cat}</Badge>
            ))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
