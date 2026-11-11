import type { ReactNode } from "react";
import Link from "next/link";
import { EventRowBody, type RaceRowEvent } from "@/components/explore/event-row-body";
import { PlannedRaceRow } from "@/components/race/planned-race-row";
import { SaveRaceButton } from "@/components/race/save-race-button";

/** A race link and its separate plan control, shared by Discover and Browse. */
export function RaceItem({
  race,
  locale,
  href,
  distanceKm,
  factsLabel,
  seriesSlug,
  tags,
  inPlan,
  onSaved,
}: {
  race: RaceRowEvent;
  locale: string;
  href: string;
  distanceKm?: number | null;
  factsLabel?: string;
  seriesSlug?: string;
  tags?: ReactNode;
  inPlan?: boolean;
  onSaved?: () => Promise<void> | void;
}) {
  return (
    <PlannedRaceRow eventId={race.id} inPlan={inPlan} className="race-row">
      <Link href={href} className="race-row-link" data-series-round={seriesSlug}>
        <EventRowBody
          event={race}
          locale={locale}
          distanceKm={distanceKm}
          factsLabel={factsLabel}
          tags={tags}
          seriesRound={Boolean(seriesSlug)}
          compact
        />
      </Link>
      <SaveRaceButton eventId={race.id} raceName={race.name} locale={locale} variant="row" inPlan={inPlan} onSaved={onSaved} />
    </PlannedRaceRow>
  );
}
