"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Cloud, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Droplets, ExternalLink, Moon, Sun, Thermometer, Wind } from "lucide-react";
import { MetaRow } from "@/components/explore/meta-row";
import { ExplainedHint } from "@/components/explore/explained-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { asLocale, type Locale } from "@/lib/i18n/messages";
import type { Climate, ClimateYear, ForecastHour, RaceWeather as Weather, Sky } from "@/lib/weather-model";
import { createWeatherLoader, currentWeather } from "@/lib/weather-cache";
import { wantsForecast } from "@/lib/weather-model";

const copy: Record<Locale, {
  label: string;
  forecast: string;
  day: string;
  night: string;
  rainChance: string;
  wind: string;
  past: string;
  pastShort: string;
  pastRain: string;
  climateHelp: string;
  windy: string;
  chartTitle: string;
  chartTemp: string;
  chartRain: string;
  tipTemp: string;
  tipRain: string;
  chartAverage: string;
  chartWeek: string;
  chartHint: string;
  section: string;
  dayForecast: string;
  rowTemp: string;
  rowRain: string;
  rowWind: string;
  sky: Record<Sky, string>;
}> = {
  en: {
    label: "Weather",
    forecast: "Forecast",
    day: "by day",
    night: "at night",
    rainChance: "rain {n} %",
    wind: "wind {n} km/h",
    past: "In past years around this date",
    pastShort: "Average of the last {n} years",
    pastRain: "rain on {n} % of days",
    climateHelp: "Average of the week around this date over the last {n} years. Weather data: Open-Meteo.",
    windy: "Forecast on Windy",
    chartTitle: "Past {n} years",
    chartTemp: "Temperature (°C): daytime high and night-time low",
    chartRain: "Rain (mm in the week)",
    tipTemp: "{max}° by day, {min}° at night",
    tipRain: "{n} mm",
    chartAverage: "{n}-year average: {max}° by day, {min}° at night, {rain} mm a week",
    chartWeek: "{from} – {to}, every year",
    chartHint: "Point at a year to see it.",
    section: "Weather",
    dayForecast: "Forecast: {day}",
    rowTemp: "Temperature (°C)",
    rowRain: "Rain (mm)",
    rowWind: "Wind (km/h), gusts",
    sky: { clear: "sunny", partly: "partly cloudy", cloudy: "cloudy", fog: "fog", rain: "rain", snow: "snow", storm: "storms" },
  },
  cs: {
    label: "Počasí",
    forecast: "Předpověď",
    day: "přes den",
    night: "v noci",
    rainChance: "déšť {n} %",
    wind: "vítr {n} km/h",
    past: "V minulých letech kolem tohoto data",
    pastShort: "Průměr za posledních {n} let",
    pastRain: "pršelo v {n} % dnů",
    climateHelp: "Průměr týdne kolem tohoto data za posledních {n} let. Data o počasí: Open-Meteo.",
    windy: "Předpověď na Windy",
    chartTitle: "Posledních {n} let",
    chartTemp: "Teplota (°C): přes den a v noci",
    chartRain: "Srážky (mm za týden)",
    tipTemp: "přes den {max}°, v noci {min}°",
    tipRain: "{n} mm",
    chartAverage: "Průměr za {n} let: přes den {max}°, v noci {min}°, {rain} mm za týden",
    chartWeek: "{from} – {to} v každém roce",
    chartHint: "Najeď na rok a uvidíš jeho hodnoty.",
    section: "Počasí",
    dayForecast: "Předpověď: {day}",
    rowTemp: "Teplota (°C)",
    rowRain: "Déšť (mm)",
    rowWind: "Vítr (km/h), nárazy",
    sky: { clear: "slunečno", partly: "polojasno", cloudy: "zataženo", fog: "mlha", rain: "déšť", snow: "sníh", storm: "bouřky" },
  },
  pl: {
    label: "Pogoda",
    forecast: "Prognoza",
    day: "w dzień",
    night: "w nocy",
    rainChance: "deszcz {n} %",
    wind: "wiatr {n} km/h",
    past: "W poprzednich latach w tym terminie",
    pastShort: "Średnia z ostatnich {n} lat",
    pastRain: "deszcz w {n} % dni",
    climateHelp: "Średnia z tygodnia wokół tej daty z ostatnich {n} lat. Dane pogodowe: Open-Meteo.",
    windy: "Prognoza na Windy",
    chartTitle: "Ostatnie {n} lat",
    chartTemp: "Temperatura (°C): w dzień i w nocy",
    chartRain: "Opady (mm w tygodniu)",
    tipTemp: "w dzień {max}°, w nocy {min}°",
    tipRain: "{n} mm",
    chartAverage: "Średnia z {n} lat: w dzień {max}°, w nocy {min}°, {rain} mm na tydzień",
    chartWeek: "{from} – {to} w każdym roku",
    chartHint: "Najedź na rok, aby zobaczyć wartości.",
    section: "Pogoda",
    dayForecast: "Prognoza: {day}",
    rowTemp: "Temperatura (°C)",
    rowRain: "Deszcz (mm)",
    rowWind: "Wiatr (km/h), porywy",
    sky: { clear: "słonecznie", partly: "częściowe zachmurzenie", cloudy: "pochmurno", fog: "mgła", rain: "deszcz", snow: "śnieg", storm: "burze" },
  },
  sk: {
    label: "Počasie",
    forecast: "Predpoveď",
    day: "cez deň",
    night: "v noci",
    rainChance: "dážď {n} %",
    wind: "vietor {n} km/h",
    past: "V minulých rokoch okolo tohto dátumu",
    pastShort: "Priemer za posledných {n} rokov",
    pastRain: "pršalo v {n} % dní",
    climateHelp: "Priemer týždňa okolo tohto dátumu za posledných {n} rokov. Údaje o počasí: Open-Meteo.",
    windy: "Predpoveď na Windy",
    chartTitle: "Posledných {n} rokov",
    chartTemp: "Teplota (°C): cez deň a v noci",
    chartRain: "Zrážky (mm za týždeň)",
    tipTemp: "cez deň {max}°, v noci {min}°",
    tipRain: "{n} mm",
    chartAverage: "Priemer za {n} rokov: cez deň {max}°, v noci {min}°, {rain} mm za týždeň",
    chartWeek: "{from} – {to} v každom roku",
    chartHint: "Prejdi na rok a uvidíš jeho hodnoty.",
    section: "Počasie",
    dayForecast: "Predpoveď: {day}",
    rowTemp: "Teplota (°C)",
    rowRain: "Dážď (mm)",
    rowWind: "Vietor (km/h), nárazy",
    sky: { clear: "slnečno", partly: "polojasno", cloudy: "zamračené", fog: "hmla", rain: "dážď", snow: "sneh", storm: "búrky" },
  },
  de: {
    label: "Wetter",
    forecast: "Vorhersage",
    day: "tagsüber",
    night: "nachts",
    rainChance: "Regen {n} %",
    wind: "Wind {n} km/h",
    past: "In den letzten Jahren um dieses Datum",
    pastShort: "Durchschnitt der letzten {n} Jahre",
    pastRain: "Regen an {n} % der Tage",
    climateHelp: "Durchschnitt der Woche um dieses Datum in den letzten {n} Jahren. Wetterdaten: Open-Meteo.",
    windy: "Vorhersage auf Windy",
    chartTitle: "Letzte {n} Jahre",
    chartTemp: "Temperatur (°C): tagsüber und nachts",
    chartRain: "Niederschlag (mm pro Woche)",
    tipTemp: "tagsüber {max}°, nachts {min}°",
    tipRain: "{n} mm",
    chartAverage: "Durchschnitt aus {n} Jahren: tagsüber {max}°, nachts {min}°, {rain} mm pro Woche",
    chartWeek: "{from} – {to}, jedes Jahr",
    chartHint: "Zeig auf ein Jahr, um es zu sehen.",
    section: "Wetter",
    dayForecast: "Vorhersage: {day}",
    rowTemp: "Temperatur (°C)",
    rowRain: "Regen (mm)",
    rowWind: "Wind (km/h), Böen",
    sky: { clear: "sonnig", partly: "heiter bis wolkig", cloudy: "bewölkt", fog: "Nebel", rain: "Regen", snow: "Schnee", storm: "Gewitter" },
  },
};

const SKY_ICON: Record<Sky, React.ReactNode> = {
  clear: <Sun />,
  partly: <CloudSun />,
  cloudy: <Cloud />,
  fog: <CloudFog />,
  rain: <CloudRain />,
  snow: <CloudSnow />,
  storm: <CloudLightning />,
};

const fill = (s: string, values: Record<string, number | string>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));

/**
 * Windy opened on the race's spot with its hour-by-hour forecast for that
 * point. The path names the point; `?lat,lng,zoom` alone only moves the map,
 * and Windy dropped it for its home page.
 */
export function windyUrl(lat: number, lng: number): string {
  const at = `${lat.toFixed(3)}/${lng.toFixed(3)}`;
  return `https://www.windy.com/${at}?${lat.toFixed(3)},${lng.toFixed(3)},11`;
}

// The line and the chart on one page ask the same question once.
const loadWeather = createWeatherLoader();

function useWeather(lat: number, lng: number, date: string) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}:${date}`;
  const [weather, setWeather] = useState<{ key: string; data: Weather | null } | null>(null);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      loadWeather(lat, lng, date).then((w) => live && setWeather({ key, data: w }));
    };
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      live = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [lat, lng, date, key]);
  return weather?.key === key ? currentWeather(weather.data) : null;
}

type Props = { lat: number; lng: number; date: string; locale: string };

/**
 * The forecast link's name on the race card, which lists its links together:
 * what it is for, not whose site it opens.
 */
export function windyLabel(locale: string): string {
  return FORECAST_LINK[asLocale(locale)];
}
const FORECAST_LINK: Record<Locale, string> = {
  cs: "Předpověď počasí",
  sk: "Predpoveď počasia",
  pl: "Prognoza pogody",
  de: "Wettervorhersage",
  en: "Weather forecast",
};
const WEATHER_SOURCES = {
  "open-meteo": { name: "Open-Meteo", url: "https://open-meteo.com/" },
  "visual-crossing": { name: "Visual Crossing Weather", url: "https://www.visualcrossing.com/" },
};

/**
 * The race day's weather, loaded after the page: a forecast when the day is
 * close, and what the week around this date was like in past years. Nothing
 * at all when there is no answer — a race page does not wait for the weather.
 */
export function RaceWeather({ lat, lng, date, locale, hideLink = false, compact = false }: Props & {
  /** The race card lists the Windy link among its other links instead. */
  hideLink?: boolean;
  /** The race card's look: the temperature large, rain and wind as two figures beside it. */
  compact?: boolean;
}) {
  const weather = useWeather(lat, lng, date);
  const c = copy[asLocale(locale)];
  const f = weather?.forecast;
  const k = weather?.climate;
  const forecastSource = WEATHER_SOURCES[f?.source ?? "open-meteo"];
  const climateSource = WEATHER_SOURCES[k?.source ?? "open-meteo"];
  const near = wantsForecast(date, new Date().toISOString().slice(0, 10));
  if (!weather || !f && !k && !near) return null;
  const freshnessCopy = {
    cs: { at: "Načteno", unavailable: "Předpověď se teď nepodařilo načíst. Zkusíme to znovu." },
    en: { at: "Retrieved", unavailable: "The forecast is temporarily unavailable. We will retry." },
    de: { at: "Abgerufen", unavailable: "Die Vorhersage ist derzeit nicht verfügbar. Wir versuchen es erneut." },
    pl: { at: "Pobrano", unavailable: "Prognoza jest chwilowo niedostępna. Spróbujemy ponownie." },
    sk: { at: "Načítané", unavailable: "Predpoveď sa teraz nepodarilo načítať. Skúsime to znova." },
  }[asLocale(locale)];

  // Races are ridden by day: the temperature from morning to late afternoon,
  // not the night's low. The sky is named only when it is not rain — the rain
  // chance says that already.
  const racing = f?.hours.filter((h) => h.hour >= 8 && h.hour <= 18) ?? [];
  const lo = racing.length ? Math.min(...racing.map((h) => h.temp)) : null;
  const hi = racing.length ? Math.max(...racing.map((h) => h.temp)) : f?.tmax;
  const temps = lo != null && lo !== hi ? `${lo}–${hi}°` : `${hi}°`;
  const sky = f && f.sky !== "rain" ? `, ${c.sky[f.sky]}` : "";
  // Short on the line; the tooltip says what it is: the week around this date,
  // averaged over the last years, and where the numbers come from.
  const past = k ? `${fill(c.pastShort, { n: k.years })}: ${k.tmax}°, ${fill(c.rainChance, { n: Math.round(k.rainyShare * 100) })}` : null;
  const pastHelp = k
    ? `${c.past}: ${c.day} ${k.tmax}°, ${fill(c.pastRain, { n: Math.round(k.rainyShare * 100) })}. ${fill(c.climateHelp, { n: k.years }).replace("Open-Meteo", climateSource.name)}`
    : "";
  if (compact && f) {
    return (
      <div className="rounded-xl bg-muted/60 px-3.5 py-3">
        <div className="flex items-center gap-3.5">
          <span className="text-foreground [&_svg]:size-8 [&_svg]:stroke-[1.5]" aria-hidden>{SKY_ICON[f.sky]}</span>
          <div className="min-w-0">
            <p className="text-2xl font-semibold leading-none tracking-tight tabular-nums">{temps}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground first-letter:uppercase">{c.sky[f.sky]}</p>
          </div>
          <dl className="ml-auto flex flex-col gap-1 text-sm tabular-nums">
            {f.rainChance != null ? (
              <div className="flex items-center justify-end gap-1.5">
                <Droplets className="size-3.5 text-muted-foreground" aria-hidden />
                <dd>{f.rainChance} %</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-1.5">
              <Wind className="size-3.5 text-muted-foreground" aria-hidden />
              <dd>{f.windKmh} km/h</dd>
            </div>
          </dl>
        </div>
        {past ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="mt-2.5 w-fit cursor-help border-t border-border/70 pt-2 text-xs text-muted-foreground">{past}</p>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="max-w-64 text-pretty">
              {pastHelp}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    );
  }
  return (
    <MetaRow icon={f ? SKY_ICON[f.sky] : <Thermometer />} label={c.label}>
      <span className="text-sm">
        {near && !f ? <span className="block text-muted-foreground">{freshnessCopy.unavailable}</span> : null}
        {f ? (
          // Where the forecast is from and when it was read belong to the line, not under it.
          <ExplainedHint
            className="block"
            explanation={[
              forecastSource.name,
              weather.forecastFetchedAt
                ? `${freshnessCopy.at} ${new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(weather.forecastFetchedAt))}`
                : null,
            ].filter(Boolean).join(" · ")}
          >
            <span className="font-medium">
              {c.forecast}: {temps}{sky}
            </span>
            {f.rainChance != null ? `, ${fill(c.rainChance, { n: f.rainChance })}` : ""}
            {`, ${fill(c.wind, { n: f.windKmh })}`}
          </ExplainedHint>
        ) : null}
        {past ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={f ? "block w-fit cursor-help text-xs text-muted-foreground" : "block w-fit cursor-help"}>{past}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="max-w-64 text-pretty">
              {pastHelp}
            </TooltipContent>
          </Tooltip>
        ) : null}
        {hideLink ? null : <a
          href={windyUrl(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {c.windy}
          <ExternalLink className="size-3" aria-hidden />
        </a>}
      </span>
    </MetaRow>
  );
}

const CHART_W = 520;
const CHART_H = 112;
const PAD = { top: 10, bottom: 24, left: 34, right: 6 };

/** "4. 11." in the reader's language. */
function shortDay(iso: string, offset: number, locale: string, weekday = false): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC", ...(weekday ? { weekday: "long" } : {}) }).format(d);
}

/** Round steps that hold the data, with 0 among them whenever the range crosses it. */
function niceTicks(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step; v += step) out.push(v);
  return out;
}

const NIGHT_ICON: Partial<Record<Sky, React.ReactNode>> = { clear: <Moon />, partly: <CloudMoon /> };

/**
 * The race page's weather section: the race day hour by hour when it is close
 * enough to forecast, then the same week in past years. The heading sits
 * outside the cards like every other section of the page.
 */
export function RaceWeatherSection({ lat, lng, date, locale }: Props) {
  const weather = useWeather(lat, lng, date);
  const c = copy[asLocale(locale)];
  const hours = weather?.forecast?.hours ?? [];
  const climate = weather?.climate;
  const climateSource = WEATHER_SOURCES[climate?.source ?? "open-meteo"];
  const hasDay = hours.length >= 4;
  const hasPast = Boolean(climate && climate.byYear.length >= 3);
  if (!hasDay && !hasPast) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold">{c.section}</h2>
      <div className="flex flex-col gap-4">
        {hasDay ? <RaceDayForecast hours={hours} date={date} locale={locale} lat={lat} lng={lng} /> : null}
        {hasPast ? <PastYears climate={climate!} date={date} locale={locale} /> : null}
      </div>
      {hasPast ? <p className="mt-2 text-xs text-muted-foreground">{climate!.byYear[0].year}–{climate!.byYear.at(-1)!.year} · <a href={climateSource.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{climateSource.name}</a></p> : null}
    </section>
  );
}

/**
 * The race day in two-hour steps, read across like a weather app: the hour,
 * the sky, the temperature as a line with its value at each point, then rain
 * and wind (with gusts and an arrow the way it blows).
 */
function RaceDayForecast({ hours, date, locale, lat, lng }: { hours: ForecastHour[]; date: string; locale: string; lat: number; lng: number }) {
  const c = copy[asLocale(locale)];
  const n = hours.length;
  const temps = hours.map((h) => h.temp);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  // Points sit in the middle of each column; the line's band leaves room for the labels above.
  const BAND = 40;
  const y = (t: number) => 18 + (hi === lo ? BAND / 2 : ((hi - t) / (hi - lo)) * BAND);
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const line = hours.map((h, i) => `${x(i)},${y(h.temp)}`).join(" ");
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold">{fill(c.dayForecast, { day: shortDay(date, 0, locale, true) })}</p>
        <a
          href={windyUrl(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {c.windy}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>

      <div className="mt-4" aria-hidden>
        <div className="grid text-center text-xs tabular-nums text-muted-foreground" style={cols}>
          {hours.map((h) => (
            <span key={h.hour}>{h.hour}:00</span>
          ))}
        </div>
        <div className="mt-1.5 grid justify-items-center text-foreground [&_svg]:size-6 [&_svg]:stroke-[1.5]" style={cols}>
          {hours.map((h) => (
            <span key={h.hour} className={h.sky === "clear" || h.sky === "partly" ? "text-amber-500" : "text-muted-foreground"}>
              {(!h.day && NIGHT_ICON[h.sky]) || SKY_ICON[h.sky]}
            </span>
          ))}
        </div>

        <svg viewBox={`0 0 100 ${BAND + 26}`} preserveAspectRatio="none" className="mt-1 h-16 w-full overflow-visible">
          <defs>
            <linearGradient id="race-day-temp" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" className="[stop-color:var(--color-orange-400)]" stopOpacity="0.28" />
              <stop offset="1" className="[stop-color:var(--color-orange-400)]" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`${x(0)},${BAND + 26} ${line} ${x(n - 1)},${BAND + 26}`} fill="url(#race-day-temp)" />
          <polyline points={line} fill="none" className="stroke-orange-500 dark:stroke-orange-400" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {/* Values as HTML over the line, so they stay round and sharp however wide the card is. */}
        {/* Placed by the same numbers as the line's points, so each dot sits on it. */}
        <div className="relative -mt-16 h-16">
          {hours.map((h, i) => {
            const at = { left: `${x(i)}%`, top: `${(y(h.temp) / (BAND + 26)) * 100}%` };
            return (
              <span key={h.hour}>
                <span className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-orange-500 dark:bg-orange-400" style={at} />
                <span className="absolute -translate-x-1/2 -translate-y-[calc(100%+6px)] text-sm font-semibold tabular-nums" style={at}>
                  {h.temp}°
                </span>
              </span>
            );
          })}
        </div>

        <Row icon={<CloudRain />} label={c.rowRain} cols={cols}>
          {hours.map((h) => (
            <span key={h.hour} className={h.rainMm > 0 ? "font-medium text-sky-700 dark:text-sky-300" : "text-muted-foreground"}>
              {h.rainMm > 0 ? h.rainMm.toLocaleString(locale) : "–"}
              {h.rainChance != null && h.rainChance >= 20 ? (
                <span className="block text-[10px] font-normal text-muted-foreground">{h.rainChance} %</span>
              ) : null}
            </span>
          ))}
        </Row>
        <Row icon={<Wind />} label={c.rowWind} cols={cols}>
          {hours.map((h) => (
            <span key={h.hour} className="flex flex-col items-center">
              <span className="inline-flex items-center gap-0.5 font-medium">
                {/* The arrow points where the wind goes, as on a weather map. */}
                <ArrowUp className="size-3 text-muted-foreground" style={{ transform: `rotate(${h.windFrom + 180}deg)` }} />
                {h.windKmh}
              </span>
              <span className="text-[10px] text-muted-foreground">{h.gustKmh}</span>
            </span>
          ))}
        </Row>
      </div>

      <table className="sr-only">
        <caption>{fill(c.dayForecast, { day: shortDay(date, 0, locale, true) })}</caption>
        <tbody>
          {hours.map((h) => (
            <tr key={h.hour}>
              <th scope="row">{h.hour}:00</th>
              <td>{c.sky[h.sky]}</td>
              <td>{h.temp} °C</td>
              <td>{h.rainMm} mm</td>
              <td>{h.windKmh} km/h ({h.gustKmh})</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ icon, label, cols, children }: { icon: React.ReactNode; label: string; cols: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t pt-2">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </p>
      <div className="grid text-center text-xs tabular-nums" style={cols}>
        {children}
      </div>
    </div>
  );
}

/**
 * The week around the race's date in each of the last years: each year's
 * daytime high and night-time low as a range, and the rain that fell that
 * week as a bar. Two small charts sharing the years, because two units never
 * share one axis. The line above them says the averages, or the year under
 * the pointer.
 */
function PastYears({ climate, date, locale }: { climate: Climate; date: string; locale: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const c = copy[asLocale(locale)];
  const years = climate.byYear;
  const tTicks = niceTicks(Math.min(...years.map((y) => y.tmin)), Math.max(...years.map((y) => y.tmax)), 5);
  const rTicks = niceTicks(0, Math.max(10, ...years.map((y) => y.rainMm)), 10);
  const avgRain = Math.round(years.reduce((s, y) => s + y.rainMm, 0) / years.length);
  const shown = hover != null ? years[hover] : null;
  const readout = shown
    ? `${shown.year}: ${fill(c.tipTemp, { max: shown.tmax, min: shown.tmin })}, ${fill(c.tipRain, { n: shown.rainMm })}`
    : fill(c.chartAverage, { n: years.length, max: climate.tmax, min: climate.tmin, rain: avgRain });

  return (
    <figure className="rounded-xl border bg-card p-4 sm:p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold">{fill(c.chartTitle, { n: years.length })}</span>
        <span className="text-xs text-muted-foreground">
          {fill(c.chartWeek, { from: shortDay(date, -3, locale), to: shortDay(date, 3, locale) })}
        </span>
      </figcaption>
      <p className="mt-2 min-h-5 text-sm tabular-nums" aria-live="polite">
        {readout}
      </p>
      <div className="mt-3 flex flex-col gap-5" onMouseLeave={() => setHover(null)}>
        <MiniChart title={c.chartTemp} years={years} ticks={tTicks} zero hover={hover} onHover={setHover}>
          {(y, x, w, scale) => {
            const bw = Math.min(w * 0.36, 16);
            return (
              <rect
                x={x + (w - bw) / 2}
                width={bw}
                y={scale(y.tmax)}
                height={Math.max(scale(y.tmin) - scale(y.tmax), 3)}
                rx={Math.min(bw / 2, 4)}
                className="fill-orange-500 dark:fill-orange-400"
              />
            );
          }}
        </MiniChart>
        <MiniChart title={c.chartRain} years={years} ticks={rTicks} hover={hover} onHover={setHover}>
          {(y, x, w, scale) => {
            const bw = Math.min(w * 0.5, 22);
            // A dry week still gets a stub on the baseline: an empty column reads as missing data.
            const h = Math.max(scale(0) - scale(y.rainMm), 2);
            return (
              <rect
                x={x + (w - bw) / 2}
                width={bw}
                y={scale(0) - h}
                height={h}
                rx={Math.min(3, h / 2)}
                className={y.rainMm > 0 ? "fill-sky-600 dark:fill-sky-400" : "fill-border"}
              />
            );
          }}
        </MiniChart>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        <span className="max-sm:hidden">{c.chartHint} </span>Open-Meteo
      </p>
      <table className="sr-only">
        <caption>{fill(c.chartTitle, { n: years.length })}</caption>
        <tbody>
          {years.map((y) => (
            <tr key={y.year}>
              <th scope="row">{y.year}</th>
              <td>{fill(c.tipTemp, { max: y.tmax, min: y.tmin })}</td>
              <td>{fill(c.tipRain, { n: y.rainMm })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function MiniChart({
  title,
  years,
  ticks,
  zero = false,
  hover,
  onHover,
  children,
}: {
  title: string;
  years: ClimateYear[];
  ticks: number[];
  /** Mark 0 more strongly than the other grid lines: frost is what a rider reads first. */
  zero?: boolean;
  hover: number | null;
  onHover: (i: number) => void;
  children: (y: ClimateYear, x: number, w: number, scale: (v: number) => number) => React.ReactNode;
}) {
  const lo = ticks[0]!;
  const hi = ticks[ticks.length - 1]!;
  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const w = plotW / years.length;
  const scale = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  return (
    <div aria-hidden>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</p>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full overflow-visible text-muted-foreground">
        {years.map((y, i) =>
          hover === i ? (
            <rect key={y.year} x={PAD.left + i * w + 2} width={w - 4} y={PAD.top - 6} height={plotH + 12} rx={6} className="fill-muted" />
          ) : null,
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={CHART_W - PAD.right}
              y1={scale(t)}
              y2={scale(t)}
              className={zero && t === 0 ? "stroke-muted-foreground/60" : "stroke-border"}
              strokeWidth={1}
              strokeDasharray={zero && t === 0 ? "3 3" : undefined}
            />
            <text x={PAD.left - 6} y={scale(t)} dy="0.32em" textAnchor="end" className="fill-current text-[11px] tabular-nums max-sm:text-[15px]">
              {zero ? `${t}°` : t}
            </text>
          </g>
        ))}
        {years.map((y, i) => {
          const x = PAD.left + i * w;
          return (
            <g key={y.year} onMouseEnter={() => onHover(i)} onTouchStart={() => onHover(i)}>
              {children(y, x, w, scale)}
              {/* The whole column answers the pointer, not just the thin mark. */}
              <rect x={x} width={w} y={0} height={CHART_H} fill="transparent" />
              <text
                x={x + w / 2}
                y={CHART_H - 5}
                textAnchor="middle"
                className={`text-[11px] tabular-nums max-sm:text-[15px] ${hover === i ? "fill-foreground font-medium" : "fill-current"}`}
              >
                {y.year}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
