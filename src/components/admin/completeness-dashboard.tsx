"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, Label } from "@/components/ui/primitives";
import { AUDIENCES, DISCIPLINES } from "@/lib/domain";
import {
  MISSING_LABELS,
  type IncompleteEvent,
  type MissingFlag,
  type DataQualitySummary,
} from "@/lib/admin/data-quality";
import { ExternalLink, MapPin, Pencil, X } from "lucide-react";

type Props = {
  initialSummary: DataQualitySummary;
  initialEvents: IncompleteEvent[];
};

const FILTERS: { id: MissingFlag | "all"; label: string }[] = [
  { id: "all", label: "All incomplete" },
  { id: "coords", label: "No pin" },
  { id: "place", label: "No place" },
  { id: "bad_place", label: "Bad place" },
  { id: "disciplines", label: "No discipline" },
  { id: "website", label: "No website" },
  { id: "registration", label: "No registration" },
];

export function CompletenessDashboard({ initialSummary, initialEvents }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<MissingFlag | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEvents[0]?.id ?? null,
  );
  const [events, setEvents] = useState(initialEvents);
  const [summary, setSummary] = useState(initialSummary);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => e.missing.includes(filter));
  }, [events, filter]);

  const selected = filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  async function refresh() {
    const res = await fetch("/api/admin/data-quality");
    if (!res.ok) return;
    const data = (await res.json()) as {
      summary: DataQualitySummary;
      events: IncompleteEvent[];
    };
    setSummary(data.summary);
    setEvents(data.events);
    if (selectedId && !data.events.some((e) => e.id === selectedId)) {
      setSelectedId(data.events[0]?.id ?? null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Upcoming" value={summary.total} />
        <SummaryCard label="Incomplete" value={summary.incomplete} accent />
        <SummaryCard label="No pin" value={summary.coords} />
        <SummaryCard label="Bad / no place" value={summary.place + summary.bad_place} />
        <SummaryCard label="No discipline" value={summary.disciplines} />
        <SummaryCard label="No website" value={summary.website} />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.id === "all"
              ? summary.incomplete
              : f.id === "place"
                ? summary.place
                : summary[f.id];
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide ring-1 transition ${
                active
                  ? "bg-stone-900 text-white ring-stone-900"
                  : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-50"
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_380px]">
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Work queue · {filtered.length}
            </h2>
            {pending ? <span className="text-xs text-stone-400">Saving…</span> : null}
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-6 text-sm text-stone-500">Nothing missing for this filter.</p>
            ) : (
              <ul>
                {filtered.map((event) => {
                  const active = selected?.id === event.id;
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(event.id)}
                        className={`flex w-full items-start gap-3 border-b border-stone-100 px-4 py-3 text-left transition hover:bg-stone-50 ${
                          active ? "bg-stone-100" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-stone-500">
                            {event.startDate}
                            {event.municipality || event.placeName
                              ? ` · ${event.municipality || event.placeName}`
                              : ""}
                          </p>
                          <p className="truncate text-sm font-medium tracking-tight text-stone-900">
                            {event.name}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {event.missing.map((m) => (
                              <span
                                key={m}
                                className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-amber-900 ring-1 ring-amber-200"
                              >
                                {MISSING_LABELS[m]}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-stone-400" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <aside className="rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 lg:sticky lg:top-4 lg:self-start">
          {selected ? (
            <QuickEditPanel
              key={selected.id}
              event={selected}
              busy={pending}
              onSaved={(savedId) => {
                startTransition(async () => {
                  const res = await fetch("/api/admin/data-quality");
                  if (res.ok) {
                    const data = (await res.json()) as {
                      summary: DataQualitySummary;
                      events: IncompleteEvent[];
                    };
                    setSummary(data.summary);
                    setEvents(data.events);
                    const still = data.events.filter((e) =>
                      filter === "all" ? true : e.missing.includes(filter as MissingFlag),
                    );
                    const idx = still.findIndex((e) => e.id === savedId);
                    const next =
                      still[idx + 1] ??
                      still.find((e) => e.id !== savedId) ??
                      still[0] ??
                      null;
                    setSelectedId(next?.id ?? null);
                  }
                  router.refresh();
                });
              }}
            />
          ) : (
            <p className="p-5 text-sm text-stone-500">Select a race to fill gaps.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 shadow-sm ring-1 ${
        accent
          ? "bg-stone-900 text-white ring-stone-900"
          : "bg-white text-stone-900 ring-stone-200"
      }`}
    >
      <p
        className={`font-mono text-[10px] uppercase tracking-wide ${
          accent ? "text-stone-300" : "text-stone-500"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function QuickEditPanel({
  event,
  busy,
  onSaved,
}: {
  event: IncompleteEvent;
  busy: boolean;
  onSaved: (savedId: string) => void;
}) {
  const [placeName, setPlaceName] = useState(
    event.municipality || event.placeName || "",
  );
  const [countryCode, setCountryCode] = useState(event.countryCode || "CZ");
  const [lat, setLat] = useState(event.lat != null ? String(event.lat) : "");
  const [lng, setLng] = useState(event.lng != null ? String(event.lng) : "");
  const [websiteUrl, setWebsiteUrl] = useState(event.websiteUrl || "");
  const [registrationUrl, setRegistrationUrl] = useState(event.registrationUrl || "");
  const [audience, setAudience] = useState(event.audience || "mixed");
  const [disciplines, setDisciplines] = useState<string[]>(event.disciplines || []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  function toggleDisc(d: string) {
    setDisciplines((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  async function geocodePlace() {
    if (!placeName.trim()) return;
    setGeocoding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/geocode-place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: placeName, countryCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.lat) {
        setError(data.error || "Geocode failed");
        return;
      }
      setLat(String(data.lat));
      setLng(String(data.lng));
      if (data.countryCode) setCountryCode(data.countryCode);
    } finally {
      setGeocoding(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: event.id,
        name: event.name,
        startDate: event.startDate,
        endDate: event.startDate,
        placeName: placeName.trim() || event.name,
        municipality: placeName.trim() || undefined,
        countryCode,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
        audience,
        disciplines,
        websiteUrl: websiteUrl || undefined,
        registrationUrl: registrationUrl || undefined,
        status: "scheduled",
        lockFields: true,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Save failed");
      return;
    }
    onSaved(event.id);
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-stone-100 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-wide text-stone-500">
              Quick fill
            </p>
            <h3 className="truncate text-sm font-semibold tracking-tight text-stone-900">
              {event.name}
            </h3>
          </div>
          <Link
            href={`/admin/events/${event.id}`}
            className="shrink-0 text-stone-400 hover:text-stone-800"
            title="Full edit"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {event.missing.map((m) => (
            <span
              key={m}
              className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-amber-900 ring-1 ring-amber-200"
            >
              {MISSING_LABELS[m]}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="place">Place / city</Label>
          <div className="flex gap-2">
            <Input
              id="place"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              placeholder="Blovice…"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void geocodePlace()}
              disabled={geocoding || !placeName.trim()}
              title="Resolve coordinates"
            >
              <MapPin className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="cc">CC</Label>
            <Input
              id="cc"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
              maxLength={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lat">Lat</Label>
            <Input
              id="lat"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="49.58"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lng">Lng</Label>
            <Input
              id="lng"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="13.54"
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="web">Website</Label>
          <Input
            id="web"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg">Registration URL</Label>
          <Input
            id="reg"
            value={registrationUrl}
            onChange={(e) => setRegistrationUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Audience</Label>
          <div className="flex flex-wrap gap-1.5">
            {AUDIENCES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                  audience === a
                    ? "bg-stone-900 text-white ring-stone-900"
                    : "bg-white text-stone-600 ring-stone-200"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Disciplines</Label>
          <div className="flex flex-wrap gap-1.5">
            {DISCIPLINES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDisc(d)}
                className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-medium uppercase ring-1 ${
                  disciplines.includes(d)
                    ? "bg-stone-900 text-white ring-stone-900"
                    : "bg-white text-stone-600 ring-stone-200"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="flex items-start gap-1 text-sm text-red-600">
            <X className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          className="w-full"
          disabled={saving || busy}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save & next"}
        </Button>
      </div>
    </div>
  );
}
