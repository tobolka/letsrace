"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { CalendarDays, Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { EventCard } from "@/components/explore/event-rows";
import { ItemGroup } from "@/components/ui/item";
import type { EventListItem } from "@/lib/events";
import type { MapBounds } from "@/components/map/race-map";
import { eventDisciplineFamily } from "@/lib/map-visuals";
import { todayIso } from "@/lib/date-presets";
import { LightMap, type MapProps } from "./light-map";
import "./prototype.css";

const CurrentMap = dynamic(() => import("@/components/map/race-map").then((m) => m.RaceMap), { ssr: false });
const Detail = dynamic(() => import("@/components/explore/event-detail-panel").then((m) => m.EventDetailPanel));
const initialView: MapBounds = { west: 12.4, east: 18.3, south: 48.3, north: 51.4 };
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const families = [["", "Všechny disciplíny"], ["mtb", "MTB"], ["road", "Silnice"], ["gravel", "Gravel"], ["cx", "Cyklokros"], ["bmx", "BMX"], ["track", "Dráha"]];

function BaselineMap(props: MapProps & { locale: string }) {
  const [seed] = useState(props.initialBounds);
  const center = useMemo<[number, number]>(() => [(seed.west + seed.east) / 2, (seed.south + seed.north) / 2], [seed]);
  return <CurrentMap events={props.events} selectedId={props.selectedId} onSelect={props.onSelect}
    onBoundsChange={(_b, _reason, camera) => props.onBounds(camera)} locale={props.locale}
    fallbackCenter={center} destination={seed} destinationSeq={1} skipInitialLocate
    padding={{ left: 16, right: 56, top: 48, bottom: 56 }} />;
}

export function FastMapPrototype({ initialEvents, locale, weekend, initialEngine }: {
  initialEvents: EventListItem[]; locale: string; weekend: { from: string; to: string }; initialEngine: "light" | "current";
}) {
  const [engine, setEngine] = useState(initialEngine);
  const [events, setEvents] = useState(initialEvents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bounds, setBounds] = useState(initialView);
  const [preset, setPreset] = useState("weekend");
  const [family, setFamily] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menu, setMenu] = useState<"dates" | "filters" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [mobileList, setMobileList] = useState(false);
  const [panelWidth, setPanelWidth] = useState(400);
  const dragging = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const selected = events.find((e) => e.id === selectedId) ?? null;
  const range = useMemo(() => preset === "weekend" ? weekend : { from: todayIso(), to: "" }, [preset, weekend]);
  const onBounds = useCallback((next: MapBounds) => {
    setBounds((prev) => Math.abs(prev.west - next.west) + Math.abs(prev.south - next.south) + Math.abs(prev.east - next.east) + Math.abs(prev.north - next.north) < 0.0001 ? prev : next);
  }, []);
  const choose = useCallback((id: string) => { setSelectedId(id); setMobileList(false); }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (menu) setMenu(null);
      else if (searchOpen) { setSearchOpen(false); setSearch(""); }
      else setSelectedId(null);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [menu, searchOpen]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPending(true); setError("");
      const b = bounds;
      const dx = (b.east - b.west) * .4, dy = (b.north - b.south) * .4;
      const q = new URLSearchParams({ dateFrom: range.from, west: String(b.west - dx), east: String(b.east + dx), south: String(b.south - dy), north: String(b.north + dy) });
      if (range.to) q.set("dateTo", range.to);
      try {
        const response = await fetch(`/api/events?${q}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Závody se nepodařilo obnovit.");
        const data: EventListItem[] = await response.json();
        setEvents((prev) => {
          const kept = prev.find((e) => e.id === selectedId);
          return kept && !data.some((e) => e.id === kept.id) ? [...data, kept] : data;
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally { if (!controller.signal.aborted) setPending(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [bounds, range, selectedId]);

  const filtered = useMemo(() => events.filter((e) => {
    if (family && eventDisciplineFamily(e.disciplines) !== family) return false;
    return !search || fold(`${e.name} ${e.location?.municipality ?? ""} ${e.location?.name ?? ""} ${e.series?.name ?? ""}`).includes(fold(search));
  }), [events, family, search]);
  const visible = filtered.filter((e) => {
    const lat = Number(e.location?.lat), lng = Number(e.location?.lng);
    return e.id === selectedId || (Number.isFinite(lat) && Number.isFinite(lng) && lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east);
  });

  function switchEngine(next: "light" | "current") {
    if (next === engine) return;
    setEngine(next);
    const url = new URL(window.location.href); url.searchParams.set("engine", next);
    window.history.replaceState(null, "", url);
  }
  const engineControl = <div className="fast-engine-switch" role="group" aria-label="Porovnání vykreslování mapy">
    <span>PROTOTYP</span>
    <button type="button" aria-pressed={engine === "light"} onClick={() => switchEngine("light")}>Lehká mapa</button>
    <button type="button" aria-pressed={engine === "current"} onClick={() => switchEngine("current")}>Současná</button>
  </div>;

  return <div className="fast-prototype absolute inset-0 overflow-hidden bg-background" style={{ "--fast-panel": `${panelWidth}px` } as CSSProperties}>
    <h1 className="sr-only">Prototyp rychlejší mapy závodů</h1>
    <div className="fast-map-stage absolute inset-y-0 right-0 left-0 md:left-[var(--fast-panel)]">
      {engine === "light" ? <LightMap key="light" events={filtered} selectedId={selectedId} initialBounds={bounds} onSelect={choose} onBounds={onBounds} />
        : <BaselineMap key="current" events={filtered} selectedId={selectedId} initialBounds={bounds} onSelect={choose} onBounds={onBounds} locale={locale} />}
    </div>
    <section ref={panel} className={`fast-list-panel${mobileList ? " fast-list-expanded" : ""}`} aria-label="Seznam závodů">
      <header className="flex h-12 shrink-0 items-center border-b px-4"><BrandMark size="xs" /><span className="ml-auto text-[10px] tracking-wider text-muted-foreground md:hidden">PROTOTYP</span></header>
      <div className="relative z-30 flex h-12 shrink-0 items-center gap-1 border-b px-3">
        <button type="button" className="fast-filter-button" aria-expanded={menu === "dates"} onClick={() => setMenu(menu === "dates" ? null : "dates")}><CalendarDays size={16} /><span>{preset === "weekend" ? "Tento víkend" : "Nadcházející"}</span><ChevronDown size={13} /></button>
        <button type="button" className="fast-icon-button" aria-label="Filtrovat disciplíny" aria-expanded={menu === "filters"} onClick={() => setMenu(menu === "filters" ? null : "filters")}><SlidersHorizontal size={17} />{family && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-brand" />}</button>
        <button type="button" className="fast-icon-button ml-auto" aria-label="Hledat závod" aria-expanded={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setSearch(""); }}><Search size={17} /></button>
        {menu && <><button type="button" className="fixed inset-0 -z-10 cursor-default" aria-label="Zavřít nabídku" onClick={() => setMenu(null)} />
          <div className="fast-filter-menu">
            {(menu === "dates" ? [["weekend", "Tento víkend"], ["upcoming", "Všechny nadcházející"]] : families).map(([value, label]) => <button type="button" key={value} onClick={() => { if (menu === "dates") setPreset(value); else setFamily(value); setMenu(null); }}><span>{label}</span>{(menu === "dates" ? preset : family) === value && <Check size={15} />}</button>)}
          </div></>}
      </div>
      {searchOpen && <div className="flex items-center gap-2 border-b px-4 py-2"><Search size={15} /><input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Název závodu nebo místa…" aria-label="Hledat mezi načtenými závody" className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none" /><button type="button" aria-label="Zrušit hledání" onClick={() => { setSearch(""); setSearchOpen(false); }}><X size={15} /></button></div>}
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4 text-xs text-muted-foreground">
        <span role="status" aria-live="polite">{pending ? "Obnovuji…" : `${visible.length} závodů`}</span>
        <span className="rounded-md bg-foreground px-3 py-1.5 text-background">Datum</span>
        <button type="button" className="text-foreground md:hidden" onClick={() => setMobileList(!mobileList)}>{mobileList ? "Zmenšit" : "Zobrazit seznam"}</button>
      </div>
      <main id="prototype-races" className="min-h-0 flex-1 overflow-y-auto" aria-label="Závody v mapě">
        {error && <p role="alert" className="p-4 text-sm">{error}</p>}
        <ItemGroup>{visible.map((e) => <div role="listitem" key={e.id} className="border-b border-border/50"><EventCard event={e} locale={locale} active={e.id === selectedId} onSelect={choose} /></div>)}</ItemGroup>
        {!visible.length && !pending && <p className="p-6 text-sm text-muted-foreground">V tomto výřezu nejsou závody pro zvolené filtry. Zkuste mapu oddálit.</p>}
      </main>
      <div role="separator" tabIndex={0} aria-label="Změnit šířku seznamu" aria-orientation="vertical" aria-valuemin={340} aria-valuemax={560} aria-valuenow={panelWidth} aria-controls="prototype-races"
        className="fast-panel-resize" onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (dragging.current) setPanelWidth(Math.max(340, Math.min(560, e.clientX - (panel.current?.getBoundingClientRect().left ?? 0)))); }}
        onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}
        onKeyDown={(e) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return; e.preventDefault(); setPanelWidth((w) => e.key === "Home" ? 340 : e.key === "End" ? 560 : Math.max(340, Math.min(560, w + (e.key === "ArrowRight" ? 24 : -24)))); }} />
    </section>
    <div className="fast-comparison">{engineControl}</div>
    {selected && <div className="fast-detail-overlay"><Detail event={selected} locale={locale} onClose={() => setSelectedId(null)} leftX={panelWidth + 12} /></div>}
  </div>;
}
