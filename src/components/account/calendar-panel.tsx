"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button, Badge } from "@/components/ui/primitives";
import { AuthForm } from "@/components/account/auth-form";

type Row = {
  id: string;
  status: string;
  registered: boolean;
  paid: boolean;
  member: { id: string; name: string; relationship: string } | null;
  event: {
    id: string;
    name: string;
    start_date: string;
    slug: string;
    level: string | null;
    class_label: string | null;
  } | null;
};

export function CalendarPanel({ locale }: { locale: string }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [favorites, setFavorites] = useState<{ id: string; name: string; start_date: string }[]>([]);

  async function load() {
    const supabase = createBrowserSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setAuthed(false);
      setReady(true);
      return;
    }
    setAuthed(true);

    const [{ data: att }, { data: favs }] = await Promise.all([
      supabase
        .from("event_attendance")
        .select(
          "id, status, registered, paid, member:family_members(id, name, relationship), event:events(id, name, start_date, slug, level, class_label)",
        )
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("event_favorites")
        .select("event:events(id, name, start_date)")
        .eq("user_id", auth.user.id),
    ]);

    setRows((att as unknown as Row[]) ?? []);
    setFavorites(
      ((favs ?? []) as unknown as { event: { id: string; name: string; start_date: string } | null }[])
        .map((f) => f.event)
        .filter(Boolean) as { id: string; name: string; start_date: string }[],
    );
    setReady(true);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  if (!ready) {
    return <p className="mx-auto max-w-md p-6 text-sm text-stone-500">…</p>;
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <AuthForm locale={locale} onSuccess={() => void load()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-stone-900">My calendar</h1>
          <p className="text-sm text-stone-500">Saved races and attendance.</p>
        </div>
        <Link href={`/${locale}`}>
          <Button variant="outline">← Map</Button>
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Going</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-stone-500">No races marked yet — open a race and tap Calendar.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-stone-900">
                      {r.event?.start_date
                        ? format(parseISO(r.event.start_date), "d MMM yyyy")
                        : "—"}
                    </p>
                    <p className="font-medium text-stone-900">{r.event?.name ?? "Race"}</p>
                    <p className="text-xs text-stone-500">
                      {r.member?.name} · {r.member?.relationship}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge>{r.status}</Badge>
                    {r.registered && <Badge className="bg-stone-200 text-stone-900">Registered</Badge>}
                    {r.paid && <Badge className="bg-sky-100 text-sky-800">Paid</Badge>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Favorites</h2>
        {favorites.length === 0 ? (
          <p className="text-sm text-stone-500">No saved races yet.</p>
        ) : (
          <ul className="space-y-2">
            {favorites.map((f) => (
              <li key={f.id} className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200">
                <p className="text-xs text-stone-900">
                  {format(parseISO(f.start_date), "d MMM yyyy")}
                </p>
                <p className="font-medium">{f.name}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
