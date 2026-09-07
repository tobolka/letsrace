"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DISCIPLINE_LABELS } from "@/lib/taxonomy";

/**
 * Narrow the pile before reading it.
 *
 * Unfiltered the list is a season of races across a dozen countries and takes
 * four seconds to build. One country is under a second, and it is also the only
 * way to work through this: a Czech duplicate and an Italian one are not the
 * same job, and nobody finishes either by scrolling past the other.
 */
const COUNTRIES = ["CZ", "SK", "PL", "DE", "AT", "IT", "CH", "HU", "SI", "GB", "FR"];

export function DuplicateFilters({
  country,
  discipline,
  from,
  to,
}: {
  country: string;
  discipline: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/admin/duplicates?${next.toString()}`));
  }

  const active = Boolean(country || discipline || from || to);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dup-country" className="text-xs">
          Country
        </Label>
        <select
          id="dup-country"
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
        <Label htmlFor="dup-discipline" className="text-xs">
          Discipline
        </Label>
        <select
          id="dup-discipline"
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
        <Label htmlFor="dup-from" className="text-xs">
          From
        </Label>
        <Input
          id="dup-from"
          type="date"
          className="h-9 w-40"
          defaultValue={from}
          onChange={(e) => set("from", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dup-to" className="text-xs">
          To
        </Label>
        <Input
          id="dup-to"
          type="date"
          className="h-9 w-40"
          defaultValue={to}
          onChange={(e) => set("to", e.target.value)}
        />
      </div>

      {active ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(() => router.push("/admin/duplicates"))}
        >
          Clear
        </Button>
      ) : null}
      {pending ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
    </div>
  );
}
