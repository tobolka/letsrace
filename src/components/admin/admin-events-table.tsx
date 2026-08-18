"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
}: {
  events: AdminEventRow[];
  filter: "visible" | "hidden" | "all";
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

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={filter}
        onValueChange={(value) => {
          router.push(value === "visible" ? "/admin/events" : `/admin/events?view=${value}`);
        }}
      >
        <TabsList>
          <TabsTrigger value="visible">On map</TabsTrigger>
          <TabsTrigger value="hidden">Hidden</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {events.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No events in this view</EmptyTitle>
            <EmptyDescription>Try another filter or add an event.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
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
                  <TableCell className="max-w-80 whitespace-normal">
                    <Link href={`/admin/events/${e.id}`} className="font-medium hover:underline">
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
      )}
    </div>
  );
}
