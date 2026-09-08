"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  Check,
  Map,
  UserRound,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ensureFavorite } from "@/lib/planner-db";
import { messagesFor } from "@/lib/i18n/messages";

type Hit = {
  id: string;
  slug: string;
  name: string;
  startDate: string;
  endDate: string | null;
  location: { municipality?: string | null; name?: string | null; countryCode?: string | null } | null;
};

/**
 * One key, and the race you were thinking of is in the plan.
 *
 * The slow path is: open the map, find the filters, type, find the pin, open
 * the card, mark who is going. Someone who already knows the name of the race
 * should not have to walk through any of that.
 */
export function AccountCommand({
  locale,
  open,
  onOpenChange,
}: {
  locale: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = messagesFor(locale);
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    const q = term.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    timer.current = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/events?q=${encodeURIComponent(q)}`);
          if (!res.ok) return;
          const rows = (await res.json()) as Hit[];
          setHits(rows.slice(0, 8));
        } catch {
          /* a failed lookup just means no race rows */
        }
      })();
    }, 220);
    return () => window.clearTimeout(timer.current);
  }, [term]);

  function close() {
    onOpenChange(false);
    setTerm("");
    setHits([]);
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  async function add(hit: Hit) {
    setBusy(hit.id);
    try {
      const supabase = createBrowserSupabase();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        toast.error(t.planAuthGoing);
        return;
      }
      if (!(await ensureFavorite(supabase, auth.user.id, hit.id, false))) {
        toast.error(t.saveFailed);
        return;
      }
      setAdded((prev) => new Set(prev).add(hit.id));
      toast.success(`${hit.name} — ${t.suggestAdded}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <CommandInput
        placeholder={t.searchPlaceholder}
        value={term}
        onValueChange={setTerm}
      />
      <CommandList>
        <CommandEmpty>{t.noResults}</CommandEmpty>

        {hits.length > 0 ? (
          <>
            <CommandGroup heading={t.suggestAdd}>
              {hits.map((hit) => {
                const place = hit.location?.municipality || hit.location?.name || "";
                const isAdded = added.has(hit.id);
                return (
                  <CommandItem
                    key={hit.id}
                    value={`race-${hit.id}-${hit.name}`}
                    disabled={busy === hit.id}
                    onSelect={() => void add(hit)}
                  >
                    {isAdded ? <Check /> : <CalendarPlus />}
                    <span className="min-w-0 flex-1 truncate">{hit.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {hit.startDate}
                      {place ? ` · ${place}` : ""}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}

        <CommandGroup heading={t.account}>
          <CommandItem value={`plan ${t.myCalendar}`} onSelect={() => go(`/${locale}/account`)}>
            <CalendarDays />
            {t.myCalendar}
          </CommandItem>
          <CommandItem value={`alerts ${t.alertTitle}`} onSelect={() => go(`/${locale}/account/alerts`)}>
            <Bell />
            {t.alertTitle}
          </CommandItem>
          <CommandItem value={`account ${t.account}`} onSelect={() => go(`/${locale}/account/settings`)}>
            <UserRound />
            {t.account}
          </CommandItem>
          <CommandItem value={`map ${t.viewOnMap}`} onSelect={() => go(`/${locale}`)}>
            <Map />
            {t.viewOnMap}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
