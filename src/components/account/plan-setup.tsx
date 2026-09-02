"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, MapPin, Users, Flag } from "lucide-react";
import { PlacePicker, type PickedPlace } from "@/components/account/place-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { messagesFor } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * Three things make the rest of this page work: who rides, where you start
 * from, and one race in the plan. Until all three are there the page cannot do
 * its job, so it says which one is missing rather than looking empty.
 */
export function PlanSetup({
  locale,
  hasPeople,
  hasPlace,
  hasRace,
  onSetHome,
}: {
  locale: string;
  hasPeople: boolean;
  hasPlace: boolean;
  hasRace: boolean;
  onSetHome: (place: PickedPlace) => Promise<void> | void;
}) {
  const t = messagesFor(locale);
  const [pickingPlace, setPickingPlace] = useState(false);
  if (hasPeople && hasPlace && hasRace) return null;

  const steps: {
    done: boolean;
    icon: React.ElementType;
    title: string;
    body: string;
    cta: string;
    href?: string;
    onCta?: () => void;
    expand?: React.ReactNode;
  }[] = [
    {
      done: hasPeople,
      icon: Users,
      title: t.planSetupPeople,
      body: t.planSetupPeopleBody,
      href: `/${locale}/account`,
      cta: t.profilesAdd,
    },
    {
      done: hasPlace,
      icon: MapPin,
      title: t.planSetupPlace,
      body: t.planSetupPlaceBody,
      cta: t.alertAdd,
      // The place is two taps from here; sending them to another page to type
      // one town name is the kind of detour that ends a setup half-done.
      onCta: () => setPickingPlace(true),
      expand: pickingPlace ? (
        <PlacePicker locale={locale} onPick={(place) => void onSetHome(place)} />
      ) : null,
    },
    {
      done: hasRace,
      icon: Flag,
      title: t.planSetupRace,
      body: t.planSetupRaceBody,
      href: `/${locale}`,
      cta: t.viewOnMap,
    },
  ];
  const done = steps.filter((s) => s.done).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.planSetupTitle}</CardTitle>
        <CardDescription>{t.planSetupBody}</CardDescription>
        <Badge variant="secondary" className="tabular-nums">
          {done}/{steps.length}
        </Badge>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {steps.map((s) => (
            <div key={s.title} className="flex flex-col gap-2">
              <Item variant="outline" size="sm" className={cn(s.done && "opacity-60")}>
                <ItemMedia variant="icon">{s.done ? <Check /> : <s.icon />}</ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full min-w-0">
                    <span className="truncate">{s.title}</span>
                  </ItemTitle>
                  <ItemDescription>{s.body}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  {s.done ? (
                    <span className="text-xs text-muted-foreground">{t.planSetupDone}</span>
                  ) : s.href ? (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={s.href}>{s.cta}</Link>
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="secondary" onClick={s.onCta}>
                      {s.cta}
                    </Button>
                  )}
                </ItemActions>
              </Item>
              {!s.done && s.expand ? (
                <div className="rounded-lg border bg-muted/30 p-3">{s.expand}</div>
              ) : null}
            </div>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
