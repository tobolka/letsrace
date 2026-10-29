import type { Locale } from "@/lib/i18n/messages";

export const catalogueViewSeo: Record<Locale, Record<"list" | "schedule", { title: string; description: string }>> = {
  cs: {
    list: { title: "Seznam cyklistických závodů", description: "Nadcházející cyklistické závody podle termínu a místa. Prohlédni si MTB, silniční, gravelové i cyklokrosové závody, kategorie a odkazy na přihlášky." },
    schedule: { title: "Kalendář cyklistických závodů", description: "Naplánuj si cyklistickou sezónu v měsíčním kalendáři. Termíny závodů, místa, kategorie a přihlášky v Česku i okolních zemích." },
  },
  en: {
    list: { title: "Cycling races by date and place", description: "Browse upcoming road, MTB, gravel and cyclocross races across Central Europe. Find dates, venues, categories and links to race registration." },
    schedule: { title: "Cycling race calendar", description: "Plan your cycling season with a monthly race calendar. Find race dates, venues, categories and registration links across Central Europe." },
  },
  sk: {
    list: { title: "Zoznam cyklistických pretekov", description: "Nadchádzajúce cyklistické preteky podľa termínu a miesta. MTB, cesta, gravel aj cyklokros s kategóriami a odkazmi na prihlášky." },
    schedule: { title: "Kalendár cyklistických pretekov", description: "Naplánuj si cyklistickú sezónu v mesačnom kalendári. Termíny pretekov, miesta, kategórie a prihlášky na Slovensku aj v okolitých krajinách." },
  },
  pl: {
    list: { title: "Lista wyścigów kolarskich", description: "Nadchodzące wyścigi kolarskie według daty i miejsca. Szosa, MTB, gravel i przełaje z kategoriami oraz linkami do zapisów." },
    schedule: { title: "Kalendarz wyścigów kolarskich", description: "Zaplanuj sezon kolarski w miesięcznym kalendarzu. Terminy, miejsca, kategorie i zapisy na wyścigi w Polsce i krajach sąsiednich." },
  },
  de: {
    list: { title: "Radrennen nach Datum und Ort", description: "Kommende Straßen-, MTB-, Gravel- und Cyclocross-Rennen in Mitteleuropa. Termine, Austragungsorte, Klassen und Links zur Anmeldung." },
    schedule: { title: "Radrennen im Monatskalender", description: "Plane deine Radsportsaison mit dem Monatskalender. Renntermine, Austragungsorte, Klassen und Anmeldung in Deutschland und den Nachbarländern." },
  },
};
