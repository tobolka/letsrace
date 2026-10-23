"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SeriesAgeRow } from "@/lib/catalog/series-ages";
import { AGE_BAND_IDS, AGE_BAND_LABELS, czechAgeBandName } from "@/lib/i18n/taxonomy";
import { cn } from "@/lib/utils";

const BANDS = AGE_BAND_IDS.map((id) => ({ id, label: AGE_BAND_LABELS[id], hint: czechAgeBandName(id) }));

/** One series per card: tick who may start, save, and every round follows. */
export function SeriesAgeReview({
  rows,
  onSave,
}: {
  rows: SeriesAgeRow[];
  onSave: (seriesId: string, ages: string[]) => Promise<number>;
}) {
  if (!rows.length) {
    return <Card className="p-6 text-sm text-muted-foreground">No series left to decide.</Card>;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{rows.length} series</p>
      {rows.map((row) => (
        <SeriesCard key={row.id} row={row} onSave={onSave} />
      ))}
    </div>
  );
}

function SeriesCard({ row, onSave }: { row: SeriesAgeRow; onSave: (id: string, ages: string[]) => Promise<number> }) {
  // Start from what a person said, else what the rounds' sources state, else
  // what the rounds carry now (often a guess) — something to correct, not a blank.
  const start = row.ages.length
    ? row.ages
    : row.suggested.length
      ? row.suggested
      : [...new Set(row.rounds.flatMap((r) => r.ages))];
  const [picked, setPicked] = useState<Set<string>>(new Set(start));
  const [saved, setSaved] = useState<string | null>(row.confirmedAt ? "confirmed" : null);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSaved(null);
      return next;
    });

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold">{row.name}</h2>
            {row.countryCode ? <Badge variant="outline">{row.countryCode}</Badge> : null}
            {saved ? (
              <Badge className="gap-1">
                <Check className="size-3" /> {saved}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {row.rounds.length} upcoming:{" "}
            {row.rounds
              .slice(0, 4)
              .map((r) => `${r.startDate.slice(5).split("-").reverse().join(".")}. ${r.name}`)
              .join(" · ")}
            {row.rounds.length > 4 ? " …" : ""}
          </p>
        </div>
        {row.websiteUrl ? (
          <a
            href={row.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
          >
            Website <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BANDS.map((b) => {
          const on = picked.has(b.id);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b.id)}
              aria-pressed={on}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                on ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
              )}
              title={b.hint}
            >
              {b.label}
              {b.hint ? <span className={cn("ml-1 text-xs", on ? "opacity-70" : "opacity-60")}>{b.hint}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={pending || picked.size === 0}
          onClick={() =>
            startTransition(async () => {
              const rounds = await onSave(row.id, [...picked]);
              setSaved(`saved · ${rounds} rounds`);
            })
          }
        >
          {pending ? "Saving…" : "Confirm for the whole series"}
        </Button>
        {row.confirmedAt ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await onSave(row.id, []);
                setSaved("cleared");
              })
            }
          >
            Clear
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
