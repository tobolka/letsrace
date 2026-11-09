"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Plus, Search, Trash2 } from "lucide-react";
import { useLoadEffect } from "@/hooks/use-load-effect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { asLocale } from "@/lib/i18n/messages";
import { organizerCopy } from "@/lib/i18n/organizer-copy";
import { disciplineLabel } from "@/lib/i18n/taxonomy";
import { localePath } from "@/lib/localized-paths";

type Category = { name: string; distanceKm: number | null; ageMin: number | null; ageMax: number | null };
type Values = {
  name: string;
  startDate: string;
  endDate: string | null;
  status: string;
  websiteUrl: string | null;
  registrationUrl: string | null;
  regulationsUrl: string | null;
  registrationClosesAt: string | null;
  description: string | null;
  categories: Category[];
  disciplines: string[];
  place: { name: string; lat: number; lng: number; countryCode: string } | null;
};
type Outcome =
  | { status: "applied"; slug?: string }
  | { status: "proposed" }
  | { status: "duplicates"; duplicates: { name: string; slug: string; startDate: string }[] };

/** The disciplines a new race can be filed under, most common first. */
const CREATE_DISCIPLINES = ["road", "xco", "xcm", "gravel", "cx", "enduro", "dh", "four_cross", "hill_climb", "tt", "track", "bmx"];

const EMPTY: Values = {
  name: "",
  startDate: "",
  endDate: null,
  status: "scheduled",
  websiteUrl: null,
  registrationUrl: null,
  regulationsUrl: null,
  registrationClosesAt: null,
  description: null,
  categories: [],
  disciplines: [],
  place: null,
};

/**
 * The one race form. Editing loads the race and says whether saving changes it
 * at once (admin, verified organiser) or sends a proposal; creating asks for
 * the name, date, place and discipline as well, and checks for the same race
 * nearby that day before it adds another.
 */
export function RaceForm({ locale, slug, onDone }: { locale: string; slug?: string; onDone?: () => void }) {
  const c = organizerCopy[asLocale(locale)];
  const editing = Boolean(slug);
  const [values, setValues] = useState<Values | null>(editing ? null : EMPTY);
  const [mode, setMode] = useState<"direct" | "proposal">("proposal");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeError, setPlaceError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useLoadEffect(async () => {
    if (!slug) return;
    const res = await fetch(`/api/edits?${new URLSearchParams({ slug })}`);
    if (!res.ok) return;
    const body = (await res.json()) as { race: Omit<Values, "disciplines" | "place">; mode: "direct" | "proposal" };
    setValues({ ...EMPTY, ...body.race });
    setMode(body.mode);
  }, [slug]);

  if (!values) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => (v ? { ...v, [key]: value } : v));
  const setCat = (i: number, patch: Partial<Category>) => set("categories", values.categories.map((cat, j) => (j === i ? { ...cat, ...patch } : cat)));
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  const text = (v: string) => (v.trim() === "" ? null : v);

  async function findPlace() {
    setPlaceError(false);
    const res = await fetch(`/api/places?${new URLSearchParams({ q: placeQuery })}`).catch(() => null);
    if (!res?.ok) {
      setPlaceError(true);
      return;
    }
    const hit = (await res.json()) as { lat: number; lng: number; countryCode: string | null; displayName: string };
    if (!hit.countryCode) {
      setPlaceError(true);
      return;
    }
    set("place", { name: hit.displayName, lat: hit.lat, lng: hit.lng, countryCode: hit.countryCode.toUpperCase() });
  }

  async function save(notDuplicate = false) {
    if (!values) return;
    setBusy(true);
    setFailed(false);
    const common = {
      startDate: values.startDate,
      endDate: values.endDate || null,
      websiteUrl: values.websiteUrl,
      registrationUrl: values.registrationUrl,
      regulationsUrl: values.regulationsUrl,
      registrationClosesAt: values.registrationClosesAt || null,
      description: values.description,
      categories: values.categories.filter((cat) => cat.name.trim()),
    };
    const body = editing
      ? { action: "edit", slug, changes: { ...common, status: ["postponed", "cancelled"].includes(values.status) ? values.status : "scheduled" } }
      : { action: "create", notDuplicate, race: { ...common, name: values.name, disciplines: values.disciplines, place: values.place } };
    const res = await fetch("/api/edits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setFailed(true);
      return;
    }
    setOutcome((await res.json()) as Outcome);
  }

  if (outcome?.status === "applied" || outcome?.status === "proposed") {
    const message = outcome.status === "proposed" ? c.proposed : editing ? c.applied : c.created;
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-3 text-sm">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <BadgeCheck className="size-3.5" aria-hidden />
          </span>
          {message}
        </p>
        {outcome.status === "applied" && outcome.slug ? (
          <Button asChild className="w-full">
            <Link href={localePath(locale, `e/${outcome.slug}`)}>{c.view}</Link>
          </Button>
        ) : onDone ? (
          <Button variant="outline" className="w-full" onClick={onDone}>
            OK
          </Button>
        ) : null}
      </div>
    );
  }

  if (outcome?.status === "duplicates") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">{c.duplicatesTitle}</p>
        <ul className="divide-y rounded-xl border px-4 text-sm">
          {outcome.duplicates.map((d) => (
            <li key={d.slug} className="flex items-baseline justify-between gap-3 py-2.5">
              <Link href={localePath(locale, `e/${d.slug}`)} className="min-w-0 truncate font-medium hover:underline">
                {d.name}
              </Link>
              <span className="shrink-0 tabular-nums text-muted-foreground">{d.startDate}</span>
            </li>
          ))}
        </ul>
        <Button variant="outline" onClick={() => void save(true)} disabled={busy}>
          {c.notDuplicate}
        </Button>
      </div>
    );
  }

  const ready = editing
    ? Boolean(values.startDate)
    : Boolean(values.name.trim().length >= 3 && values.startDate && values.place && values.disciplines.length);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{mode === "direct" ? c.directNote : c.proposalNote}</p>

      {editing ? null : (
        <>
          <Field label={c.nameLabel}>
            <Input value={values.name} onChange={(e) => set("name", e.target.value)} maxLength={200} />
          </Field>
          <Field label={c.placeLabel}>
            <div className="flex gap-2">
              <Input
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void findPlace();
                  }
                }}
                placeholder={c.placePlaceholder}
              />
              <Button type="button" variant="outline" onClick={() => void findPlace()} disabled={placeQuery.trim().length < 3}>
                <Search data-icon="inline-start" />
                {c.placeSearch}
              </Button>
            </div>
            {values.place ? <p className="text-xs text-muted-foreground">{values.place.name}</p> : null}
            {placeError ? <p className="text-xs text-destructive">{c.placeNotFound}</p> : null}
          </Field>
          <Field label={c.disciplinesLabel}>
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              className="flex-wrap justify-start"
              value={values.disciplines}
              onValueChange={(v) => set("disciplines", v)}
            >
              {CREATE_DISCIPLINES.map((d) => (
                <ToggleGroupItem key={d} value={d}>
                  {disciplineLabel(d, locale)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.startDate}>
          <Input type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </Field>
        <Field label={c.endDate}>
          <Input type="date" value={values.endDate ?? ""} onChange={(e) => set("endDate", e.target.value || null)} />
        </Field>
        {editing ? (
          <Field label={c.raceStatus}>
            <select
              className="h-9 rounded-md border bg-background px-3 text-base [@media(pointer:fine)]:text-sm"
              value={["postponed", "cancelled"].includes(values.status) ? values.status : "scheduled"}
              onChange={(e) => set("status", e.target.value)}
            >
              {(Object.keys(c.raceStatuses) as (keyof typeof c.raceStatuses)[]).map((s) => (
                <option key={s} value={s}>
                  {c.raceStatuses[s]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label={c.closes}>
          <Input type="date" value={values.registrationClosesAt ?? ""} onChange={(e) => set("registrationClosesAt", e.target.value || null)} />
        </Field>
      </div>
      <Field label={c.website}>
        <Input type="url" value={values.websiteUrl ?? ""} onChange={(e) => set("websiteUrl", text(e.target.value))} placeholder="https://" />
      </Field>
      <Field label={c.registration}>
        <Input type="url" value={values.registrationUrl ?? ""} onChange={(e) => set("registrationUrl", text(e.target.value))} placeholder="https://" />
      </Field>
      <Field label={c.regulations}>
        <Input type="url" value={values.regulationsUrl ?? ""} onChange={(e) => set("regulationsUrl", text(e.target.value))} placeholder="https://" />
      </Field>
      <Field label={c.about}>
        <Textarea rows={4} maxLength={3000} value={values.description ?? ""} onChange={(e) => set("description", text(e.target.value))} />
      </Field>

      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">{c.categories}</Label>
        {values.categories.map((cat, i) => (
          <div key={i} className="grid grid-cols-[1fr_4rem_3.5rem_3.5rem_auto] items-center gap-2">
            <Input value={cat.name} onChange={(e) => setCat(i, { name: e.target.value })} maxLength={120} placeholder={c.catName} aria-label={c.catName} />
            <Input inputMode="decimal" value={cat.distanceKm ?? ""} onChange={(e) => setCat(i, { distanceKm: num(e.target.value) })} placeholder={c.catKm} aria-label={c.catKm} />
            <Input inputMode="numeric" value={cat.ageMin ?? ""} onChange={(e) => setCat(i, { ageMin: num(e.target.value) })} placeholder={c.catAgeMin} aria-label={c.catAgeMin} />
            <Input inputMode="numeric" value={cat.ageMax ?? ""} onChange={(e) => setCat(i, { ageMax: num(e.target.value) })} placeholder={c.catAgeMax} aria-label={c.catAgeMax} />
            <Button variant="ghost" size="icon" aria-label={c.remove} onClick={() => set("categories", values.categories.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <div>
          <Button variant="outline" size="sm" onClick={() => set("categories", [...values.categories, { name: "", distanceKm: null, ageMin: null, ageMax: null }])}>
            <Plus data-icon="inline-start" />
            {c.addCategory}
          </Button>
        </div>
      </div>

      {failed ? <p className="text-sm text-destructive">{c.failed}</p> : null}
      <Button className="w-full" onClick={() => void save()} disabled={busy || !ready}>
        {busy ? <Spinner data-icon="inline-start" /> : null}
        {mode === "direct" ? c.save : c.sendProposal}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
