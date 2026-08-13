"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui/primitives";
import { AUDIENCES, DISCIPLINES } from "@/lib/domain";

export type EventFormValues = {
  id?: string;
  name: string;
  startDate: string;
  endDate?: string;
  placeName: string;
  municipality?: string;
  countryCode: string;
  lat?: string;
  lng?: string;
  audience: string;
  disciplines: string[];
  websiteUrl?: string;
  registrationUrl?: string;
  status: string;
  lockFields: boolean;
};

const empty: EventFormValues = {
  name: "",
  startDate: "",
  endDate: "",
  placeName: "",
  municipality: "",
  countryCode: "CZ",
  lat: "",
  lng: "",
  audience: "mixed",
  disciplines: [],
  websiteUrl: "",
  registrationUrl: "",
  status: "scheduled",
  lockFields: true,
};

export function EventForm({ initial }: { initial?: Partial<EventFormValues> }) {
  const router = useRouter();
  const [values, setValues] = useState<EventFormValues>({ ...empty, ...initial });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleDisc(d: string) {
    set(
      "disciplines",
      values.disciplines.includes(d)
        ? values.disciplines.filter((x) => x !== d)
        : [...values.disciplines, d],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/events", {
      method: values.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: values.id,
        name: values.name,
        startDate: values.startDate,
        endDate: values.endDate || values.startDate,
        placeName: values.placeName,
        municipality: values.municipality || values.placeName,
        countryCode: values.countryCode,
        lat: values.lat ? Number(values.lat) : undefined,
        lng: values.lng ? Number(values.lng) : undefined,
        audience: values.audience,
        disciplines: values.disciplines,
        websiteUrl: values.websiteUrl || undefined,
        registrationUrl: values.registrationUrl || undefined,
        status: values.status,
        lockFields: values.lockFields,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Save failed");
      return;
    }
    const data = await res.json();
    router.push(`/admin/events/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Race name">
          <Input required value={values.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Official URL (optional, will be watched)">
          <Input
            type="url"
            value={values.websiteUrl}
            onChange={(e) => set("websiteUrl", e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Start date">
          <Input
            required
            type="date"
            value={values.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </Field>
        <Field label="End date">
          <Input type="date" value={values.endDate} onChange={(e) => set("endDate", e.target.value)} />
        </Field>
        <Field label="Place / start location">
          <Input required value={values.placeName} onChange={(e) => set("placeName", e.target.value)} />
        </Field>
        <Field label="Municipality">
          <Input value={values.municipality} onChange={(e) => set("municipality", e.target.value)} />
        </Field>
        <Field label="Country">
          <select
            className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
            value={values.countryCode}
            onChange={(e) => set("countryCode", e.target.value)}
          >
            {["CZ", "DE", "AT", "SK", "PL", "IT"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Audience">
          <select
            className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
            value={values.audience}
            onChange={(e) => set("audience", e.target.value)}
          >
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Latitude">
          <Input value={values.lat} onChange={(e) => set("lat", e.target.value)} placeholder="50.21" />
        </Field>
        <Field label="Longitude">
          <Input value={values.lng} onChange={(e) => set("lng", e.target.value)} placeholder="15.83" />
        </Field>
        <Field label="Registration URL">
          <Input
            type="url"
            value={values.registrationUrl}
            onChange={(e) => set("registrationUrl", e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
            value={values.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {(
              [
                ["scheduled", "Scheduled (on map)"],
                ["tbc", "TBC (on map)"],
                ["postponed", "Postponed (on map)"],
                ["hidden", "Hidden (not on map)"],
                ["cancelled", "Cancelled"],
              ] as const
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-stone-500">
            Use Hidden for camps, trainings, and other non-race listings
          </p>
        </Field>
      </div>

      <div>
        <Label>Disciplines</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {DISCIPLINES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDisc(d)}
              className={`rounded-full px-3 py-1 text-xs ring-1 ${
                values.disciplines.includes(d)
                  ? "bg-stone-900 text-white ring-stone-900"
                  : "bg-white ring-stone-200"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={values.lockFields}
          onChange={(e) => set("lockFields", e.target.checked)}
        />
        Lock these fields so the watcher cannot overwrite them
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : values.id ? "Save changes" : "Create event"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
