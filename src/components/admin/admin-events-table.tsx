"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { firstOpenableUrl, OpenUrlButton } from "@/components/admin/open-url";

export type AdminEventRow = {
  id: string;
  name: string;
  start_date: string;
  audience: string;
  source_kind: string;
  status: string;
  visibility: string;
  website_url: string | null;
  registration_url: string | null;
  location: { name?: string; country_code?: string } | null;
};

export function AdminEventsTable({
  events,
  filter,
  when,
  q,
  page,
  pageSize,
  total,
}: {
  events: AdminEventRow[];
  filter: "visible" | "hidden" | "all";
  when: string;
  q: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setVisibility(id: string, visibility: "public" | "hidden") {
    setBusyId(id);
    const res = await fetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, visibility, lockFields: true }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Update failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  function go(next: Partial<{ view: string; when: string; q: string; page: number }>) {
    const params = new URLSearchParams();
    const v = next.view ?? filter;
    const w = next.when ?? when;
    const term = next.q ?? q;
    // Any change of what you are looking at starts the paging over; staying on
    // page 7 of a different question is never what you meant.
    const p = next.page ?? 1;
    if (v !== "visible") params.set("view", v);
    if (w !== "upcoming") params.set("when", w);
    if (term) params.set("q", term);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    router.push(qs ? `/admin/events?${qs}` : "/admin/events");
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(value) => go({ view: value })}>
          <TabsList>
            <TabsTrigger value="visible">On map</TabsTrigger>
            <TabsTrigger value="hidden">Hidden</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={when} onValueChange={(value) => go({ when: value })}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="all">Any date</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchBox value={q} onSubmit={(term) => go({ q: term })} />
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {total.toLocaleString()} {total === 1 ? "race" : "races"}
        </span>
      </div>

      {events.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No events in this view</EmptyTitle>
            <EmptyDescription>Try another filter or add an event.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Place</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e) => {
              const loc = e.location;
              const hidden = e.visibility === "hidden" || e.status === "hidden";
              const busy = pending || busyId === e.id;
              const url = firstOpenableUrl(e.website_url, e.registration_url);
              return (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">{e.start_date}</TableCell>
                  {/* Wide enough that a long Italian race title is two lines
                      rather than six, and clamped so one entry cannot make a
                      row taller than the screen. */}
                  <TableCell className="min-w-64 max-w-96 whitespace-normal">
                    <Link
                      href={`/admin/events/${e.id}`}
                      className="line-clamp-2 font-medium hover:underline"
                      title={e.name}
                    >
                      {e.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {loc?.name ?? "—"}
                    {loc?.country_code ? ` · ${loc.country_code}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={hidden ? "secondary" : "outline"}>
                      {hidden ? "hidden" : e.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.source_kind === "manual" ? "default" : "secondary"}>
                      {e.source_kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <OpenUrlButton href={url} label="Open race URL" />
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={busy}
                        onClick={() => void setVisibility(e.id, hidden ? "public" : "hidden")}
                      >
                        {busyId === e.id ? <Spinner data-icon="inline-start" /> : null}
                        {hidden ? "Show on map" : "Discard"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      )}

      {lastPage > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => go({ page: page - 1 })}
          >
            Previous
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            Page {page} of {lastPage}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => go({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Submits on Enter rather than on every keystroke — each search is a round
 *  trip to the server, and 2,000 races do not need filtering as you type. */
function SearchBox({ value, onSubmit }: { value: string; onSubmit: (term: string) => void }) {
  const [term, setTerm] = useState(value);
  useEffect(() => setTerm(value), [value]);
  return (
    <form
      className="min-w-48 flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(term.trim());
      }}
    >
      <Input
        type="search"
        value={term}
        placeholder="Search by name…"
        aria-label="Search races by name"
        onChange={(e) => setTerm(e.target.value)}
        onBlur={() => term.trim() !== value && onSubmit(term.trim())}
      />
    </form>
  );
}
