"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SuspiciousPair, SuspiciousSide } from "@/lib/catalog/suspicious-duplicates";

/**
 * One question per card: are these two races the same race?
 *
 * The two sides are laid out identically so the eye can run down them and find
 * the difference — a round number, a series, a start list on a different timing
 * system. Merging asks which one survives, because that choice is not obvious
 * from a score: the row with more sources usually has the better links, but the
 * row with the fuller name usually reads better on the map.
 */
export function DuplicateReview({
  pairs,
  onMerge,
  onDismiss,
}: {
  pairs: SuspiciousPair[];
  onMerge: (keepId: string, dropId: string) => Promise<void>;
  onDismiss: (leftId: string, rightId: string) => Promise<void>;
}) {
  if (!pairs.length) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Nothing to look at. Every pair sharing a venue, a day and a discipline has either been
        merged or marked as two races.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {pairs.length} {pairs.length === 1 ? "pair" : "pairs"} waiting
      </p>
      {pairs.map((pair) => (
        <PairCard key={pair.key} pair={pair} onMerge={onMerge} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function PairCard({
  pair,
  onMerge,
  onDismiss,
}: {
  pair: SuspiciousPair;
  onMerge: (keepId: string, dropId: string) => Promise<void>;
  onDismiss: (leftId: string, rightId: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function run(action: () => Promise<void>, label: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setDone(label);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not work");
      }
    });
  }

  if (done) {
    return (
      <Card className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
        <Check className="size-4" aria-hidden /> {done}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{pair.date}</Badge>
        <span>{pair.place}</span>
        {pair.country ? (
          <>
            <span aria-hidden>·</span>
            <span>{pair.country}</span>
          </>
        ) : null}
        <span aria-hidden>·</span>
        <span>{pair.discipline}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Side side={pair.left} />
        <Side side={pair.right} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => onMerge(pair.left.id, pair.right.id), `Kept “${pair.left.name}”`)
          }
        >
          Keep left <ArrowRight aria-hidden />
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => onMerge(pair.right.id, pair.left.id), `Kept “${pair.right.name}”`)
          }
        >
          Keep right <ArrowRight aria-hidden />
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          className="ml-auto"
          onClick={() =>
            run(() => onDismiss(pair.left.id, pair.right.id), "Marked as two races")
          }
        >
          Two races
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </Card>
  );
}

function Side({ side }: { side: SuspiciousSide }) {
  const dates =
    side.endDate && side.endDate !== side.startDate
      ? `${side.startDate} – ${side.endDate}`
      : side.startDate;
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border p-3">
      <Link
        href={`/admin/events/${side.id}`}
        className="text-sm font-medium underline-offset-4 hover:underline"
      >
        {side.name}
      </Link>
      <p className="text-xs text-muted-foreground">
        {dates}
        {side.series ? ` · ${side.series}` : ""}
        {side.disciplines.length ? ` · ${side.disciplines.join(", ")}` : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        {side.sources} {side.sources === 1 ? "source" : "sources"}
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        {side.websiteUrl ? <OutLink href={side.websiteUrl} label="Site" /> : null}
        {side.registrationUrl ? <OutLink href={side.registrationUrl} label="Entry" /> : null}
      </div>
    </div>
  );
}

function OutLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
    >
      <ExternalLink className="size-3" aria-hidden />
      {label}
    </a>
  );
}
