"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UrlInput } from "@/components/admin/open-url";
import { AUDIENCES, DISCIPLINES } from "@/lib/domain";
import { europeCountryOptions } from "@/lib/geo/europe";

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
  regulationsUrl?: string;
  status: string;
  visibility: string;
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
  regulationsUrl: "",
  status: "scheduled",
  visibility: "public",
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
        regulationsUrl: values.regulationsUrl || undefined,
        status: values.status,
        visibility: values.visibility,
        lockFields: values.lockFields,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.error || "Save failed";
      setError(message);
      toast.error(message);
      return;
    }
    const data = await res.json();
    toast.success(values.id ? "Event saved" : "Event created");
    router.push(`/admin/events/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardContent>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="name">Race name</FieldLabel>
                <Input
                  id="name"
                  required
                  value={values.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="websiteUrl">Official URL</FieldLabel>
                <UrlInput
                  id="websiteUrl"
                  value={values.websiteUrl ?? ""}
                  onChange={(value) => set("websiteUrl", value)}
                  openLabel="Open official URL"
                />
                <FieldDescription>Optional — will be watched</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="startDate">Start date</FieldLabel>
                <Input
                  id="startDate"
                  required
                  type="date"
                  value={values.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endDate">End date</FieldLabel>
                <Input
                  id="endDate"
                  type="date"
                  value={values.endDate}
                  onChange={(e) => set("endDate", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="placeName">Place / start location</FieldLabel>
                <Input
                  id="placeName"
                  required
                  value={values.placeName}
                  onChange={(e) => set("placeName", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="municipality">Municipality</FieldLabel>
                <Input
                  id="municipality"
                  value={values.municipality}
                  onChange={(e) => set("municipality", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="countryCode">Country</FieldLabel>
                <Select
                  value={values.countryCode}
                  onValueChange={(value) => set("countryCode", value)}
                >
                  <SelectTrigger id="countryCode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {europeCountryOptions(values.countryCode).map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Audience</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  spacing={2}
                  value={values.audience}
                  onValueChange={(value) => {
                    if (value) set("audience", value);
                  }}
                  aria-label="Audience"
                >
                  {AUDIENCES.map((a) => (
                    <ToggleGroupItem key={a} value={a}>
                      {a}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="lat">Latitude</FieldLabel>
                <Input
                  id="lat"
                  value={values.lat}
                  onChange={(e) => set("lat", e.target.value)}
                  placeholder="50.21"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="lng">Longitude</FieldLabel>
                <Input
                  id="lng"
                  value={values.lng}
                  onChange={(e) => set("lng", e.target.value)}
                  placeholder="15.83"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="registrationUrl">Registration URL</FieldLabel>
                <UrlInput
                  id="registrationUrl"
                  value={values.registrationUrl ?? ""}
                  onChange={(value) => set("registrationUrl", value)}
                  openLabel="Open registration"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="regulationsUrl">Propozice / PDF</FieldLabel>
                <UrlInput
                  id="regulationsUrl"
                  value={values.regulationsUrl ?? ""}
                  onChange={(value) => set("regulationsUrl", value)}
                  placeholder="https://…/propozice.pdf"
                  openLabel="Open regulations"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <Select value={values.status} onValueChange={(value) => set("status", value)}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="scheduled">Scheduled (on map)</SelectItem>
                      <SelectItem value="tbc">TBC (off map until confirmed)</SelectItem>
                      <SelectItem value="postponed">Postponed (on map)</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="visibility">Visibility</FieldLabel>
                <Select
                  value={values.visibility ?? (values.status === "hidden" ? "hidden" : "public")}
                  onValueChange={(value) => set("visibility", value)}
                >
                  <SelectTrigger id="visibility" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="public">Public (on map)</SelectItem>
                      <SelectItem value="hidden">Hidden (not on map)</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Hide camps, trainings, and other non-race listings without changing race status
                </FieldDescription>
              </Field>
            </div>

            <FieldSet>
              <FieldLegend variant="label">Disciplines</FieldLegend>
              <ToggleGroup
                type="multiple"
                variant="outline"
                spacing={2}
                value={values.disciplines}
                onValueChange={(value) => set("disciplines", value)}
                aria-label="Disciplines"
                className="flex flex-wrap"
              >
                {DISCIPLINES.map((d) => (
                  <ToggleGroupItem key={d} value={d}>
                    {d}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>

            <Field orientation="horizontal">
              <Checkbox
                id="lockFields"
                checked={values.lockFields}
                onCheckedChange={(checked) => set("lockFields", checked === true)}
              />
              <FieldLabel htmlFor="lockFields" className="font-normal">
                Lock these fields so the watcher cannot overwrite them
              </FieldLabel>
            </Field>

            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner data-icon="inline-start" /> : null}
            {values.id ? "Save changes" : "Create event"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
