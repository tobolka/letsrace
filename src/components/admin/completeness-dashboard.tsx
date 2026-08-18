"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MapPin, SquarePen, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AUDIENCES, DISCIPLINES } from "@/lib/domain";
import {
  MISSING_LABELS,
  type IncompleteEvent,
  type MissingFlag,
  type DataQualitySummary,
} from "@/lib/admin/data-quality";
import { firstOpenableUrl, OpenUrlButton, UrlInput } from "@/components/admin/open-url";

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
  const [selectedId, setSelectedId] = useState<string | null>(initialEvents[0]?.id ?? null);
  const [events, setEvents] = useState(initialEvents);
  const [summary, setSummary] = useState(initialSummary);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => e.missing.includes(filter));
  }, [events, filter]);

  const selected = filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  function filterCount(id: MissingFlag | "all") {
    if (id === "all") return summary.incomplete;
    if (id === "place") return summary.place;
    return summary[id];
  }

  function refreshAfter(removedId: string) {
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
        const idx = still.findIndex((e) => e.id === removedId);
        const next =
          still[idx + 1] ?? still.find((e) => e.id !== removedId) ?? still[0] ?? null;
        setSelectedId(next?.id ?? null);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Upcoming" value={summary.total} />
        <SummaryCard label="Incomplete" value={summary.incomplete} accent />
        <SummaryCard label="No pin" value={summary.coords} />
        <SummaryCard label="Bad / no place" value={summary.place + summary.bad_place} />
        <SummaryCard label="No discipline" value={summary.disciplines} />
        <SummaryCard label="No website" value={summary.website} />
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        spacing={2}
        value={filter}
        onValueChange={(value) => {
          if (value) setFilter(value as MissingFlag | "all");
        }}
        aria-label="Incomplete filter"
        className="flex flex-wrap justify-start"
      >
        {FILTERS.map((f) => (
          <ToggleGroupItem key={f.id} value={f.id}>
            {f.label}
            <span className="text-muted-foreground tabular-nums">{filterCount(f.id)}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Work queue</CardTitle>
            <CardDescription className="tabular-nums">{filtered.length} races</CardDescription>
            {pending ? (
              <CardAction>
                <Spinner />
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="max-h-[70vh] overflow-auto p-0">
            {filtered.length === 0 ? (
              <Empty className="border-0">
                <EmptyHeader>
                  <EmptyTitle>Nothing missing</EmptyTitle>
                  <EmptyDescription>Nothing missing for this filter.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Race</TableHead>
                    <TableHead>Place</TableHead>
                    <TableHead>Missing</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((event) => {
                    const active = selected?.id === event.id;
                    const place = event.municipality || event.placeName;
                    const url = firstOpenableUrl(event.websiteUrl, event.registrationUrl);
                    return (
                      <TableRow
                        key={event.id}
                        data-state={active ? "selected" : undefined}
                        className="cursor-pointer"
                        onClick={() => setSelectedId(event.id)}
                        aria-selected={active}
                      >
                        <TableCell className="tabular-nums text-muted-foreground">
                          {event.startDate}
                        </TableCell>
                        <TableCell className="max-w-80 min-w-48 whitespace-normal font-medium">
                          {event.name}
                        </TableCell>
                        <TableCell className="max-w-48 whitespace-normal text-muted-foreground">
                          {place || "—"}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="flex flex-wrap gap-1">
                            {event.missing.map((m) => (
                              <Badge key={m} variant="outline">
                                {MISSING_LABELS[m]}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <OpenUrlButton href={url} label="Open race URL" />
                            <DiscardRaceButton
                              name={event.name}
                              icon
                              disabled={pending}
                              onDiscard={() => discardRace(event.id, event.name, refreshAfter)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0 lg:sticky lg:top-4 lg:self-start">
          {selected ? (
            <QuickEditPanel
              key={selected.id}
              event={selected}
              busy={pending}
              onSaved={refreshAfter}
              onDiscarded={refreshAfter}
            />
          ) : (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyTitle>Select a race</EmptyTitle>
                <EmptyDescription>Select a race to fill gaps.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </Card>
      </div>
    </div>
  );
}

async function discardRace(
  id: string,
  name: string,
  onDone: (id: string) => void,
) {
  const res = await fetch("/api/admin/events", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, visibility: "hidden", lockFields: true }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    toast.error(data.error || "Discard failed");
    return;
  }
  toast.success(`Discarded ${name}`);
  onDone(id);
}

function DiscardRaceButton({
  name,
  disabled,
  icon,
  onDiscard,
}: {
  name: string;
  disabled?: boolean;
  icon?: boolean;
  onDiscard: () => void | Promise<void>;
}) {
  const trigger = icon ? (
    <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} aria-label="Discard race">
      <Trash2 />
    </Button>
  ) : (
    <Button type="button" variant="outline" disabled={disabled}>
      Discard
    </Button>
  );

  const triggerWithTooltip = icon ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      </TooltipTrigger>
      <TooltipContent>Discard</TooltipContent>
    </Tooltip>
  ) : (
    <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
  );

  return (
    <AlertDialog>
      {triggerWithTooltip}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this race?</AlertDialogTitle>
          <AlertDialogDescription>
            {name} will leave the map. Restore it later from Events → Hidden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void onDiscard()}>
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
    <Card className={accent ? "bg-primary text-primary-foreground" : undefined}>
      <CardHeader>
        <CardDescription className={accent ? "text-primary-foreground/70" : undefined}>
          {label}
        </CardDescription>
        <CardTitle className="tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function QuickEditPanel({
  event,
  busy,
  onSaved,
  onDiscarded,
}: {
  event: IncompleteEvent;
  busy: boolean;
  onSaved: (savedId: string) => void;
  onDiscarded: (id: string) => void;
}) {
  const [placeName, setPlaceName] = useState(event.municipality || event.placeName || "");
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
  const raceUrl = firstOpenableUrl(websiteUrl, registrationUrl, event.websiteUrl, event.registrationUrl);

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
        const message = data.error || "Geocode failed";
        setError(message);
        toast.error(message);
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
      const message = data.error || "Save failed";
      setError(message);
      toast.error(message);
      return;
    }
    toast.success("Saved");
    onSaved(event.id);
  }

  return (
    <>
      <CardHeader className="border-b py-4">
        <CardDescription>Quick fill</CardDescription>
        <CardTitle className="text-base leading-snug">{event.name}</CardTitle>
        <CardAction>
          <div className="flex gap-1">
            <OpenUrlButton href={raceUrl} label="Open race URL" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" asChild>
                  <Link href={`/admin/events/${event.id}`} aria-label="Full edit">
                    <SquarePen />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Full edit</TooltipContent>
            </Tooltip>
          </div>
        </CardAction>
        <div className="flex flex-wrap gap-1">
          {event.missing.map((m) => (
            <Badge key={m} variant="outline">
              {MISSING_LABELS[m]}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="py-4">
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="place">Place / city</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="place"
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                placeholder="Blovice…"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label="Resolve coordinates"
                  disabled={geocoding || !placeName.trim()}
                  onClick={() => void geocodePlace()}
                >
                  {geocoding ? <Spinner /> : <MapPin />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field>
              <FieldLabel htmlFor="cc">CC</FieldLabel>
              <Input
                id="cc"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="lat">Lat</FieldLabel>
              <Input
                id="lat"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="49.58"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="lng">Lng</FieldLabel>
              <Input
                id="lng"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="13.54"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="web">Website</FieldLabel>
            <UrlInput
              id="web"
              value={websiteUrl}
              onChange={setWebsiteUrl}
              openLabel="Open website"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="reg">Registration URL</FieldLabel>
            <UrlInput
              id="reg"
              value={registrationUrl}
              onChange={setRegistrationUrl}
              openLabel="Open registration"
            />
          </Field>

          <Field>
            <FieldLabel>Audience</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={2}
              size="sm"
              value={audience}
              onValueChange={(value) => {
                if (value) setAudience(value);
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
            <FieldLabel>Disciplines</FieldLabel>
            <ToggleGroup
              type="multiple"
              variant="outline"
              spacing={2}
              size="sm"
              value={disciplines}
              onValueChange={setDisciplines}
              aria-label="Disciplines"
              className="flex flex-wrap"
            >
              {DISCIPLINES.map((d) => (
                <ToggleGroupItem key={d} value={d}>
                  {d}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          {error ? <FieldError>{error}</FieldError> : null}
        </FieldGroup>
      </CardContent>
      <CardFooter className="border-t py-4">
        <div className="flex w-full gap-2">
          <DiscardRaceButton
            name={event.name}
            disabled={saving || busy}
            onDiscard={() => discardRace(event.id, event.name, onDiscarded)}
          />
          <Button
            type="button"
            className="flex-1"
            disabled={saving || busy}
            onClick={() => void save()}
          >
            {saving ? <Spinner data-icon="inline-start" /> : null}
            Save & next
          </Button>
        </div>
      </CardFooter>
    </>
  );
}
