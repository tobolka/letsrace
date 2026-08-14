"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/primitives";

export type AdminEventRow = {
  id: string;
  name: string;
  start_date: string;
  audience: string;
  source_kind: string;
  status: string;
  visibility: string;
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
      alert(data.error || "Update failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ["visible", "On map"],
            ["hidden", "Hidden"],
            ["all", "All"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={key === "visible" ? "/admin/events" : `/admin/events?view=${key}`}
            className={`rounded-full px-3 py-1 ring-1 ${
              filter === key
                ? "bg-stone-900 text-white ring-stone-900"
                : "bg-white text-stone-700 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-stone-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Place</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2 text-right">Map</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-stone-500">
                  No events in this view
                </td>
              </tr>
            ) : (
              events.map((e) => {
                const loc = e.location;
                const hidden = e.visibility === "hidden" || e.status === "hidden";
                return (
                  <tr key={e.id} className="border-t border-stone-100">
                    <td className="px-3 py-2 whitespace-nowrap">{e.start_date}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/events/${e.id}`}
                        className="font-medium text-stone-900 hover:underline"
                      >
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {loc?.name ?? "—"}
                      {loc?.country_code ? ` · ${loc.country_code}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={hidden ? "bg-stone-200 text-stone-700" : ""}>
                        {hidden ? "hidden" : e.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        className={
                          e.source_kind === "manual" ? "bg-orange-100 text-orange-800" : ""
                        }
                      >
                        {e.source_kind}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={pending || busyId === e.id}
                        onClick={() =>
                          void setVisibility(e.id, hidden ? "public" : "hidden")
                        }
                        className="rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-stone-200 hover:bg-stone-50 disabled:opacity-40"
                      >
                        {busyId === e.id ? "…" : hidden ? "Show on map" : "Hide"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
