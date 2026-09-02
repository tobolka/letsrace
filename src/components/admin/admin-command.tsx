"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Flag,
  Globe,
  Inbox,
  LayoutDashboard,
  MapPin,
  Play,
  Plus,
  Radar,
  Moon,
  Sun,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
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
  { href: "/admin", label: "Overview", icon: LayoutDashboard, keys: "dashboard home control" },
  { href: "/admin/sources", label: "Sources", icon: Globe, keys: "watched urls calendars feeds" },
  { href: "/admin/events", label: "Events", icon: Flag, keys: "races catalogue catalog" },
  { href: "/admin/discovery", label: "Discovery", icon: Radar, keys: "triage discovered links" },
  { href: "/admin/inbox", label: "Inbox", icon: Inbox, keys: "feedback submissions riders" },
  { href: "/admin/events/new", label: "Add a race", icon: Plus, keys: "new create event" },
];

/**
 * The keyboard is the fastest route through an admin, and everything here is
 * either a place to go, a race to find, or one of three jobs to kick off. One
 * key opens all of it, and searching sees hidden races — finding the row you
 * need to unhide is most of why anyone opens this.
 */
export function AdminCommand({
  open,
  onOpenChange,
  dark,
  onToggleTheme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dark: boolean;
  onToggleTheme: () => void;
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [running, setRunning] = useState<string | null>(null);
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

  const close = useCallback(() => {
    onOpenChange(false);
    setTerm("");
    setHits([]);
  }, [onOpenChange]);

  function go(href: string) {
    close();
    router.push(href);
  }

  async function run(job: "watch-now" | "geocode", label: string) {
    setRunning(job);
    close();
    const t = toast.loading(`${label}…`);
    try {
      const res = await fetch(`/api/admin/${job}`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { upserted?: number; error?: string };
      if (!res.ok) throw new Error(data.error || "failed");
      toast.success(
        data.upserted != null ? `${label}: ${data.upserted} races upserted` : `${label} finished`,
        { id: t },
      );
      router.refresh();
    } catch (err) {
      toast.error(`${label} failed — ${(err as Error).message}`, { id: t });
    } finally {
      setRunning(null);
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <CommandInput
        placeholder="Find a race, jump to a page, run a job…"
        value={term}
        onValueChange={setTerm}
      />
      <CommandList>
        <CommandEmpty>Nothing matches that.</CommandEmpty>

        {hits.length > 0 ? (
          <>
            <CommandGroup heading="Races">
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
                      hidden
                    </Badge>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}

        <CommandGroup heading="Go to">
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

        <CommandSeparator />

        <CommandGroup heading="Run">
          <CommandItem
            value="run watcher ingest fetch sources"
            disabled={running != null}
            onSelect={() => void run("watch-now", "Watcher")}
          >
            <Play />
            Run the watcher
            <CommandShortcut>ingest</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="geocode pins locations map"
            disabled={running != null}
            onSelect={() => void run("geocode", "Geocoder")}
          >
            <MapPin />
            Geocode pending places
          </CommandItem>
          <CommandItem
            value="theme dark light appearance"
            onSelect={() => {
              onToggleTheme();
              close();
            }}
          >
            {dark ? <Sun /> : <Moon />}
            {dark ? "Switch to light" : "Switch to dark"}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
