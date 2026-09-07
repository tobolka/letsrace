"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DISCIPLINE_LABELS } from "@/lib/taxonomy";

/**
 * Turn a list into a job.
 *
 * Eighteen pages of hidden races is not something anyone reads to the end, and
 * the page gave no way to say which of them you were dealing with. These are
 * the three cuts that make a session finishable: one country, one discipline,
 * or one specific gap — every race with no entry link, every race with no
 * coordinates — so the queue has a shape and an end.
 */
const COUNTRIES = ["CZ", "SK", "PL", "DE", "AT", "IT", "CH", "HU", "SI", "GB", "FR"];

const WHY = [
  { id: "merged", label: "Merged into another" },
  { id: "dropped", label: "Dropped from calendar" },
  { id: "no_link", label: "No usable link" },
  { id: "by_hand", label: "Hidden by hand" },
];

const TRUST = [
  { id: "official", label: "Official entry" },
  { id: "series", label: "Series page" },
  { id: "calendar", label: "Calendar listing" },
  { id: "low", label: "Low" },
];

const MISSING = [
  { id: "website", label: "No website" },
  { id: "registration", label: "No entry link" },
  { id: "disciplines", label: "No discipline" },
  { id: "coords", label: "No place" },
];

export function AdminEventFilters({
  country,
  discipline,
  missing,
  why,
  trust,
}: {
  country: string;
  discipline: string;
  missing: string;
  why: string;
  trust: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (value) next.set(key, value);
    else next.delete(key);
    // A new filter is a new list: page two of the old one means nothing.
    next.delete("page");
    startTransition(() => router.push(`/admin/events?${next.toString()}`));
  }

  const active = Boolean(country || discipline || missing || why || trust);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ev-country" className="text-xs">
          Country
        </Label>
        <select
          id="ev-country"
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
          value={country}
          onChange={(e) => set("country", e.target.value)}
        >
          <option value="">Any</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ev-discipline" className="text-xs">
          Discipline
        </Label>
        <select
          id="ev-discipline"
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
          value={discipline}
          onChange={(e) => set("discipline", e.target.value)}
        >
          <option value="">Any</option>
          {Object.entries(DISCIPLINE_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ev-missing" className="text-xs">
          Missing
        </Label>
        <select
          id="ev-missing"
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
          value={missing}
          onChange={(e) => set("missing", e.target.value)}
        >
          <option value="">Anything</option>
          {MISSING.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ev-why" className="text-xs">
          Why hidden
        </Label>
        <select
          id="ev-why"
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
          value={why}
          onChange={(e) => set("why", e.target.value)}
        >
          <option value="">Any reason</option>
          {WHY.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ev-trust" className="text-xs">
          Confidence
        </Label>
        <select
          id="ev-trust"
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
          value={trust}
          onChange={(e) => set("trust", e.target.value)}
        >
          <option value="">Any</option>
          {TRUST.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {active ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            const next = new URLSearchParams(params?.toString() ?? "");
            for (const k of ["country", "discipline", "missing", "why", "trust", "page"])
              next.delete(k);
            startTransition(() => router.push(`/admin/events?${next.toString()}`));
          }}
        >
          Clear
        </Button>
      ) : null}
      {pending ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
    </div>
  );
}
