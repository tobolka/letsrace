"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Flag, Inbox, LayoutDashboard, Plus } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

type Hit = {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  visibility: string;
  place: string | null;
  countryCode: string | null;
};

const PAGES = [
  { href: "/admin", label: "Co potřebuje tebe", icon: LayoutDashboard, keys: "home prehled overview" },
  { href: "/admin/inbox", label: "Zprávy od uživatelů", icon: Inbox, keys: "inbox feedback zpravy" },
  { href: "/admin/events", label: "Závody", icon: Flag, keys: "races events zavody katalog" },
  { href: "/admin/events/new", label: "Přidat závod", icon: Plus, keys: "new create pridat" },
];

/** One key to find any race, hidden ones included, or to jump to one of the admin's pages. */
export function AdminCommand({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    const q = term.trim();
    if (q.length < 2) return;
    timer.current = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/admin/events?q=${encodeURIComponent(q)}`);
          if (!res.ok) return;
          const data = (await res.json()) as { events: Hit[] };
          setHits(data.events ?? []);
        } catch {
          /* a failed lookup just means no race rows */
        }
      })();
    }, 220);
    return () => window.clearTimeout(timer.current);
  }, [term]);

  /** A term too short to search for shows nothing, and forgets what the last one found. */
  function changeTerm(next: string) {
    setTerm(next);
    if (next.trim().length < 2) setHits([]);
  }

  const close = useCallback(() => {
    onOpenChange(false);
    setTerm("");
    setHits([]);
  }, [onOpenChange]);

  function go(href: string) {
    close();
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <CommandInput
        placeholder="Najdi závod nebo stránku…"
        value={term}
        onValueChange={changeTerm}
      />
      <CommandList>
        <CommandEmpty>Nic takového není.</CommandEmpty>

        {hits.length > 0 ? (
          <>
            <CommandGroup heading="Závody">
              {hits.map((hit) => (
                <CommandItem
                  key={hit.id}
                  value={`race-${hit.id}-${hit.name}`}
                  onSelect={() => go(`/admin/events/${hit.id}`)}
                >
                  {hit.visibility === "public" ? <Eye /> : <EyeOff />}
                  <span className="min-w-0 flex-1 truncate">{hit.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {hit.startDate}
                    {hit.place ? ` · ${hit.place}` : ""}
                  </span>
                  {hit.visibility !== "public" ? (
                    <Badge variant="secondary" className="shrink-0">
                      skrytý
                    </Badge>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}

        <CommandGroup heading="Stránky">
          {PAGES.map((page) => (
            <CommandItem
              key={page.href}
              value={`${page.label} ${page.keys}`}
              onSelect={() => go(page.href)}
            >
              <page.icon />
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>

      </CommandList>
    </CommandDialog>
  );
}
