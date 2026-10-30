"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { focusKeyboardItem, keyboardListIndex, visibleKeyboardItems } from "@/lib/keyboard-navigation";

const KEYBOARD_COPY: Record<string, { skip: string; races: string; calendar: string }> = {
  cs: { skip: "Přeskočit na obsah", races: "Šipky nahoru a dolů přepínají závody, Home a End přejdou na první a poslední. Enter nebo mezerník otevře detail, Tab přejde do otevřeného detailu a Escape jej zavře.", calendar: "Šipky vlevo a vpravo posouvají den, nahoru a dolů týden. Home a End přejdou na začátek a konec týdne. Enter nebo mezerník otevře den." },
  en: { skip: "Skip to content", races: "Up and Down switch races; Home and End go to the first and last. Enter or Space opens details, Tab enters the open details, and Escape closes them.", calendar: "Left and Right move by day, Up and Down by week. Home and End go to the start and end of the week. Enter or Space opens the day." },
  pl: { skip: "Przejdź do treści", races: "Strzałki w górę i w dół zmieniają wyścig; Home i End przechodzą do pierwszego i ostatniego. Enter lub spacja otwiera szczegóły, Tab przechodzi do nich, a Escape je zamyka.", calendar: "Strzałki w lewo i w prawo zmieniają dzień, w górę i w dół tydzień. Home i End przechodzą na początek i koniec tygodnia. Enter lub spacja otwiera dzień." },
  sk: { skip: "Preskočiť na obsah", races: "Šípky nahor a nadol prepínajú preteky, Home a End prejdú na prvé a posledné. Enter alebo medzerník otvorí detail, Tab prejde do otvoreného detailu a Escape ho zavrie.", calendar: "Šípky vľavo a vpravo posúvajú deň, nahor a nadol týždeň. Home a End prejdú na začiatok a koniec týždňa. Enter alebo medzerník otvorí deň." },
  de: { skip: "Zum Inhalt springen", races: "Pfeil auf und ab wechselt das Rennen; Pos1 und Ende springen zum ersten und letzten. Eingabe oder Leertaste öffnet Details, Tab wechselt zu den offenen Details und Escape schließt sie.", calendar: "Pfeil links und rechts wechselt den Tag, auf und ab die Woche. Pos1 und Ende springen zum Wochenanfang und Wochenende. Eingabe oder Leertaste öffnet den Tag." },
};

/** Shared, scoped keyboard behavior; text fields, maps and popovers keep their own keys. */
export function KeyboardNavigation({ locale }: { locale: string }) {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const copy = KEYBOARD_COPY[locale] ?? KEYBOARD_COPY.en;

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      document.getElementById("main-content")?.focus({ preventScroll: true });
    }
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey && event.key !== "Tab") return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target || target.closest("input, textarea, select, [contenteditable]:not([contenteditable=false]), [role=combobox], [role=slider], [role=menu], [role=listbox], [role=tablist]")) return;
      if (event.key === "Escape" && target.closest(".keyboard-index")) {
        event.preventDefault();
        document.getElementById("main-content")?.focus({ preventScroll: true });
        return;
      }

      const panel = Array.from(document.querySelectorAll<HTMLElement>("[data-race-detail=floating]"))
        .find((el) => el.getClientRects().length > 0);
      const row = target.closest<HTMLElement>("[data-keyboard-item]");
      // Radix and Vaul own keys inside overlays, apart from our explicit lists.
      if (!row && target.closest("[role=dialog], [data-slot=popover-content], [data-slot=drawer-content]")) return;
      const inPanel = panel?.contains(target);
      const selectedRow = panel && visibleKeyboardItems(document).find((el) => el.dataset.eventId === panel.dataset.eventId);
      const panelControls = panel && Array.from(panel.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], [tabindex='0']"))
        .filter((el) => el.getClientRects().length > 0);

      // Keep the floating detail next to its selected row in the keyboard order.
      if (event.key === "Tab") {
        if (!event.shiftKey && row && row === selectedRow && panelControls?.[0]) {
          event.preventDefault();
          panelControls[0].focus();
        } else if (event.shiftKey && target === panelControls?.[0] && selectedRow) {
          event.preventDefault();
          focusKeyboardItem(selectedRow);
        }
        return;
      }
      // Arrows in the open card (or after clicking a map pin) use the visible list.
      const current = row ?? ((inPanel || target === document.body || target.closest(".fast-marker")) ? selectedRow : undefined);
      if (!current) return;
      const group = current.closest("[data-keyboard-list]");
      if (!group) return;
      const items = visibleKeyboardItems(group);
      const index = keyboardListIndex(event.key, items.indexOf(current), items.length);
      if (index === null) return;
      event.preventDefault();
      const next = items[index];
      focusKeyboardItem(next);
      // A link in the family plan only moves focus; opening it still takes Enter.
      if (next.tagName === "BUTTON" && !group.hasAttribute("data-keyboard-focus-only")) next.click();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return <>
    <a href="#main-content" className="skip-link">{copy.skip}</a>
    <p id="race-keyboard-help" className="sr-only">{copy.races}</p>
    <p id="calendar-keyboard-help" className="sr-only">{copy.calendar}</p>
  </>;
}
