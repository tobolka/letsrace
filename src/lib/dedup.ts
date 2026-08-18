import { normalizeName } from "@/lib/domain";

/** Haversine distance in km */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Known series / cup aliases → stable token for matching across languages. */
const SERIES_ALIAS_RULES: { re: RegExp; token: string }[] = [
  {
    re: /\b(cesky\s*pohar|cesky\s*pohar\s*mtb|czech\s*mtb\s*cup|czech\s*cup|cp\s*mtb|[cč]p\s*mtb)\b/i,
    token: "series:cesky_pohar_mtb",
  },
  { re: /\bprima\s*cup\b/i, token: "series:prima_cup" },
  { re: /\btalent\s*cup\b|\btalentcup\b/i, token: "series:talent_cup" },
  { re: /\bmtb\s*biatlon\b/i, token: "series:mtb_biatlon" },
  { re: /\bkolo\s*pro\b|\bkolopro\b/i, token: "series:kolopro" },
  { re: /\bjunior\s*cup\b/i, token: "series:junior_cup" },
  { re: /\byoungsters\s*cup\b|\bayc\b/i, token: "series:youngsters_cup" },
  { re: /\bmountainbike\s*liga\b|\bml-?austria\b/i, token: "series:mountainbike_liga" },
  { re: /\bsportklasse\s*cup\b|\baustria\s*amateur\s*cup\b|\bmtb\s*amateur\s*cup\b|\bamateur\s*cup\b/i, token: "series:sportklasse_cup" },
  { re: /\bnachwuchscup\b|\bmtb\s*nachwuchs/i, token: "series:at_nachwuchscup" },
  { re: /\bauner\s*gravity\b|\baustria(?:n)?\s*(?:auner\s*)?gravity\s*series\b|\baags\b|\baustria(?:n)?\s*downhill\s*cup\b/i, token: "series:at_gravity" },
  { re: /\b(vpace\s*)?kids\s*cup\b/i, token: "series:kids_cup" },
  { re: /\bcube\s*(kids\s*)?cup\b/i, token: "series:cube_cup" },
  { re: /\btbc\b|\btbc\s*s[eé]rie\b/i, token: "series:tbc_cx" },
  { re: /\brookies\s*(dh\s*)?cup\b|\brdc\b/i, token: "series:rookies_dh" },
  { re: /\bixs\s*(european\s*)?(downhill|dh)\s*cup\b|\bixs\s*edc\b|\bixs\s*dhc\b/i, token: "series:ixs_dh" },
  { re: /\bczech\s*enduro|\benduro\s*serie/i, token: "series:czech_enduro" },
  { re: /\bprazsky\s*mtb\s*pohar|pražský\s*mtb\s*pohár/i, token: "series:prazsky_mtb" },
  { re: /\bcesky\s*pohar\s*mtb|český\s*pohár\s*mtb|poharmtb/i, token: "series:cesky_pohar_mtb" },
  { re: /\buci\s*mtb\s*world\s*(cup|series)\b/i, token: "series:uci_mtb_ws" },
  { re: /\bd[eě]tsk[yý]\s*mtb\s*cup\b/i, token: "series:detsky_mtb_cup" },
  {
    re: /\bvelk[yý]\s*h[aá]j\b|\bpohar\s*m[cč]\s*praha\s*4\b/i,
    token: "series:pohar_praha_4",
  },
  {
    re: /\bppkbike\b|\bpohar\s*plzenskeho\s*kraje\b/i,
    token: "series:ppkbike",
  },
  { re: /\bpohar\s*kv\s*kraje\b/i, token: "series:pohar_kv_hk" },
  { re: /\bdetska\s*tour(\s*petra\s*sagana)?\b|\bdtps\b/i, token: "series:dtps" },
  { re: /\balb-?gold\s*juniors/i, token: "series:alb_gold" },
  { re: /\brookies\s*cup\s*ostbayern\b/i, token: "series:rookies_ostbayern" },
  { re: /\bxco-?bikecup\b/i, token: "series:xco_bikecup" },
  { re: /\bjunior\s*bike\s*cup\b/i, token: "series:junior_bike_cup" },
  { re: /\bon-off\s*mtb/i, token: "series:on_off_mtb" },
  { re: /\bpoland\s*bike\b/i, token: "series:poland_bike" },
  { re: /\bsalzkammergut\s*trophy\b/i, token: "series:skg_trophy" },
  { re: /\bpeklo\s*severu\b/i, token: "series:peklo_severu" },
  { re: /\bsport\s*challenge\b/i, token: "series:sport_challenge" },
  { re: /\bsumavsk[yý]\s*(mtb\s*)?pohar\b|\bšumavsk[yý]\s*(mtb\s*)?pohár\b/i, token: "series:sumavsky" },
  { re: /\bbayerwald\s*mtb\s*cup\b/i, token: "series:bayerwald" },
  { re: /\bwerdenfels/i, token: "series:werdenfels" },
  { re: /\bpodkrkonossk[yý]\s*maraton\b|\bpodkrkonošsk[yý]\s*maraton\b/i, token: "series:podkrkonossky" },
  { re: /\brhein-main\s*cup\b/i, token: "series:rhein_main" },
  { re: /\beldorado\s*kids/i, token: "series:eldorado_kids" },
  { re: /\bktm\s*junior\s*challenge\b/i, token: "series:ktm_junior" },
  { re: /\bdetska\s*vrl\b|\bvrl\s*adriana\s*babica/i, token: "series:detska_vrl" },
  { re: /\bberg\s*&\s*bike\b|\bmpdv\s*(mountainbike\s*)?cup\b/i, token: "series:berg_bike" },
  { re: /\bwiesbadener\s*stadtmeisterschaft\b/i, token: "series:wiesbaden_stadt" },
  { re: /\ballga[eu]er\s*alpenwasser\b/i, token: "series:allgaeu_kids" },
  { re: /\bzanzenberg\b/i, token: "series:zanzenberg" },
  { re: /\bglobmetal\b/i, token: "series:globmetal" },
  { re: /\b(skoda\s*)?swiss\s*bike\s*cup\b/i, token: "series:skoda_swiss_bike" },
  { re: /\bvittoria(-fischer)?\b/i, token: "series:vittoria_fischer" },
  { re: /\bkids\s*bike\s*cup\s*valais\b|\bvalais\/wallis\b/i, token: "series:valais_kids" },
  { re: /\bvaliant\s*gp\b/i, token: "series:valiant_gp" },
  { re: /\bbike\s*kingdom\b/i, token: "series:bike_kingdom" },
  { re: /\bbundicycling\b/i, token: "series:bundi_kids" },
  { re: /\beiger\s*bike.*kids\b|\bkids\s*race.*eiger\b/i, token: "series:eiger_kids" },
  { re: /\beiger\s*bike\s*challenge\b/i, token: "series:eiger_adult" },
  { re: /\bkids\s*bike\s*trophy\b/i, token: "series:kids_bike_trophy" },
  { re: /\bxco-nrw\b|\bschuler[\s-]*cup\b|\bschüler[\s-]*cup\b/i, token: "series:xco_nrw" },
  { re: /\brena\s*kids\b/i, token: "series:rena_kids" },
  { re: /\bsparkassen[\s-]*kids\b/i, token: "series:albstadt_kids" },
  { re: /\bstoakart\b/i, token: "series:stoakart" },
  { re: /\bjarni\s*bahno\b|\bbahno\b/i, token: "series:bahno" },
  { re: /\bbike\s*revolution\b/i, token: "series:bike_revolution" },
  { re: /\bbikeside\b/i, token: "series:bikeside" },
  { re: /\bcopa\s*madrid\b/i, token: "series:copa_madrid" },
  { re: /\blillelunds\b/i, token: "series:lillelunds" },
  { re: /\bmtb\s*race\s*series\b/i, token: "series:mtb_race_series" },
  { re: /\bmarathon[\s-]*man\b/i, token: "series:marathon_man" },
  { re: /\bkr[aá]l\s+[sš]umavy\b/i, token: "series:kral_sumavy" },
  { re: /\bmalevil\b/i, token: "series:malevil" },
  { re: /\bhoral\b/i, token: "series:horal" },
  { re: /\bnationalpark\s*bike\b/i, token: "series:np_bike" },
  { re: /\bgrand\s*raid\b/i, token: "series:grand_raid" },
  { re: /\bevol[eé]nard\s*fmv\b/i, token: "series:evolenard_fmv" },
  { re: /\bpomerania\b/i, token: "series:pomerania" },
  { re: /\bsilesia\s*bike\b/i, token: "series:silesia_bike" },
  { re: /\bhero\s*(s[uü]dtirol|dolomites)\b/i, token: "series:hero_dolomites" },
  { re: /\btroi\s*trek\b/i, token: "series:troi_trek" },
  { re: /\bsloenduro\b/i, token: "series:sloenduro" },
  { re: /\b3\s*nations\s*cup\b/i, token: "series:3_nations" },
  { re: /\bitalia\s*bike\s*cup\s*young\b/i, token: "series:ibc_young" },
  { re: /\bitalia\s*bike\s*cup(?!\s*young)\b/i, token: "series:ibc" },
  { re: /\bcoppa\s*italia\s*giovanile\b/i, token: "series:cig_mtb" },
  { re: /\bcopa\s*catalana\s*internacional\b/i, token: "series:copa_cat_int" },
  { re: /\bcopa\s*catalunya\s*btt\b/i, token: "series:copa_cat_btt" },
  { re: /\bcopa\s*de\s*espa[nñ]a\s*xcm\b/i, token: "series:copa_es_xcm" },
  { re: /\bcopa\s*de\s*espa[nñ]a\s*enduro\b/i, token: "series:copa_es_enduro" },
  { re: /\bcopa\s*de\s*espa[nñ]a\s*(dh|descenso)\b/i, token: "series:copa_es_dh" },
  { re: /\bcroatia\s*mtb\s*xco\s*cup\b|\bmtb\s*croatia\s*cup\b/i, token: "series:croatia_xco" },
  { re: /\bkultainen\s*kampi\b/i, token: "series:kampi" },
  { re: /\b4\s*islands\s*epic\b/i, token: "series:4_islands" },
  { re: /\bmtb\s*kids\s*series\b|\bvlaanderen\s*mtb\s*kids\b/i, token: "series:vl_kids" },
  { re: /\bmtb\s*xco\s*series\b|\bvlaanderen\s*mtb\s*xco\b/i, token: "series:vl_xco" },
  { re: /\boost-nederland\b|\bmtb\s*cup\s*oost\b/i, token: "series:oost_nl" },
  { re: /\bstreetrace\b/i, token: "series:streetrace" },
  { re: /\bnk\s*mountainbike\b/i, token: "series:nk_mtb" },
  { re: /\bsloxcup\b|\bslo\s*x[\s-]*cup\b/i, token: "series:sloxcup" },
  {
    re: /\bslovenia\s*downhill\b|\bslovenija\s*downhill\b/i,
    token: "series:slovenia_dh",
  },
  { re: /\bmb\s*race\b/i, token: "series:mb_race" },
  { re: /\btransmaurienne\b/i, token: "series:transmaurienne" },
  { re: /\broc\s*d['’]?azur\b/i, token: "series:roc_azur" },
  { re: /\brye\s*bike\b/i, token: "series:rye_bike" },
  { re: /\bcrosskov[aá]csi\b/i, token: "series:crosskovacsi" },
  { re: /\balpentour\b/i, token: "series:alpentour" },
  { re: /\b(la\s*)?rioja\s*bike\b/i, token: "series:rioja_bike" },
  { re: /\b(telenet\s*)?superprestige\b/i, token: "series:superprestige" },
  { re: /\buci\s*cyclo-?cross\s*world\s*cup\b|\bcyclo-?cross\s*world\s*cup\b/i, token: "series:uci_cx_wc" },
  { re: /\buec\b/i, token: "series:uec" },
  { re: /\bworld\s*cup\b|\bswc\b|\bcdm\b/i, token: "series:world_cup" },
];

const NOISE_WORDS =
  /\b(zavod|race|open|memorial|memoria|uci|c1|c2|c3|hc|xco|xcc|xcm|dh|enduro|gravel|road|mtb|cx|bmx|elite|junior|u23|masters|kids|deti|mladez|vpace)\b/gi;

/** Calendar roots that must not count as “same URL”. */
const GENERIC_HOST_PATH =
  /^(hynekmusil\.cz|sumator\.cz|mtbs\.cz|radsport-events\.de|eventivsport\.com|velokal\.de|jiskra\.potocky\.cz|jihoceskymtbpohar\.cz|maraton\.cz|mso\.swiss)(\/(kalendar|sekce\/kalendar|map|race\/?|terminovka)?)?$/i;

/** Series calendars / hub pages — shared by every round, never identity. */
const CALENDAR_URL_PATH =
  /kidscup\.bike\/(en\/)?(race-calendar|rennkalender)|rookiescup\.bike\/(en\/)?(race-calendar|rennkalender)|ixsdownhillcup\.com\/(en\/)?(race-calendar|rennkalender)|cup\.cube\.eu\/?(anmeldung)?\/?$|kolopro\.cz\/zavody\/?$|juniorcup\.net\/?$|iprimacup\.cz\/zavody-20\d{2}|poharmtb\.cz\/(cross-country|enduro|downhill)|zapadoceskaamaterskaliga\.cz\/kalendare|prahamtb\.cz|enduroserie\.cz\/zavody|enduro\.sportsoft\.cz|cyklokros\.cz\/kalendar|ucimtbworldseries\.com\/calendar|swiss-cycling\.ch\/.*kalender|cyclingaustria\.at\/kalender|detskymtbcup\.cz\/?$|skvelopraha\.cz\/velky-haj|ppkbike\.cz|ppk-hk\.cz|cyklistikaszc\.sk\/.*kalendar|albgold-juniorscup\.de|rookiescup-ostbayern\.de\/rennen|xco-bikecup\.de|schwarzwaelder-mtb-cup\.de|rhein-eifel-mtb-cup\.de|mtb-oberschwaben-cup\.de|mtbsaarlandliga\.de\/rennen|juniorbikecup\.at\/termine|polandbike\.pl\/kalendarz|salzkammergut-trophy\.at|pekloseveru\.cz\/(cz\/)?registrace|pekloseveru\.cz\/en\/registration|pekloseveru\.cz\/.*propozice-serialu|pekloseveru\.cz\/.*series-regulations|ustimtbcup\.cz\/?$|jcp-mtb\.cz\/?$|bayerwald-mtb-cup\.com\/?$|skiclub-bb\.com\/werdenfelscup|mtb-rhein-main-cup\.de\/?$|mtb-kidscup\.de\/start\/termine-2|mountainbike-challenge\.at\/?$|soof\.sk\/podujatia-a-akcie|mpdv-cup\.de\/?$|swissbikecup\.ch(\/(en|de|fr))?\/?$|mtb-cup\.ch\/(en\/)?race\/?$|valais-cycling\.ch\/.*kids-bike-cup-valais|bikekingdom\.ch\/.*kids-cup|eigerbike\.ch\/.*kids-race|eigerbike\.ch\/.*race\/informations|marathon-man\.eu\/?$|mtbpomerania\.pl\/?$|silesia\.bike\/?$|sloenduro\.com\/.*sloenduro-calendar|sloxcup\.com\/dirke-2026|sloveniadownhillcup\.si\/(en\/)?(races|dirke)-2026|belgiancycling\.be\/.*3-nations-cup\/kalender|cycling\.vlaanderen\/competitie\/mtb\/(xco|kids)-series|mtbcompetitieoostnederland\.nl\/.*agenda-mbt-cup|knwu\.nl\/kampioenschappen\/nk-mountainbike|knwu\.nl\/nieuws\/klaar-voor-mtb-streetrace|federciclismo\.it\/.*circuiti-mtb\/(italia-bike-cup|coppa-italia-giovanile)|ciclisme\.cat\/campionat\/btt\/copa-catal|hbs\.hr\/kalendar|pyoraily\.fi\/.*kultainen-kampi|esmtb\.com\/calendario-de-las-copas-de-espana|bikeclub-engelberg\.ch\/wp\/valiant-gp|brvinfo\.ch\/bundicycling-kidscup|xco-nrw-cup\.de\/?$|schwarzwald-bike-marathon\.de\/.*rena-kids-cup|albstadt-bike-marathon\.de\/?$|rsv-bad-griesbach\.de\/?$|bahno\.ambike\.com\/?$|mtbraceseries\.ch\/egg|bikeside\.ch(\/kategorien)?\/?$|fmciclismo\.com\/.*ESCUELAS|superprestigecyclocross\.be\/.+\/kalender\/?$|ucicyclocrossworldcup\.com\/.+\/calendar\/?$|uec\.ch\/.+\/calendar|detskatour\.sk\/?$|lines-mag\.at\/austrian-gravity-series\/?$/i;

/**
 * Strip tracking noise; hostname + pathname only.
 * Returns empty string for unusable / generic calendar URLs.
 */
export function normalizeUrlForDedup(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "") || "";
    // Drop empty or root-only aggregators
    const key = `${host}${path}`.toLowerCase();
    if (GENERIC_HOST_PATH.test(key) || GENERIC_HOST_PATH.test(host)) return "";
    if (CALENDAR_URL_PATH.test(key)) return "";
    // Bare domain with no meaningful path → ignore
    if (!path || path === "/") return "";
    return key;
  } catch {
    return "";
  }
}

export function urlsOverlap(
  a: (string | null | undefined)[] | undefined,
  b: (string | null | undefined)[] | undefined,
): boolean {
  const A = new Set((a ?? []).map(normalizeUrlForDedup).filter(Boolean));
  if (!A.size) return false;
  for (const u of b ?? []) {
    const n = normalizeUrlForDedup(u);
    if (n && A.has(n)) return true;
  }
  return false;
}

/**
 * Identity string for dedup: aliases expanded, round numbers / class-only noise stripped,
 * but series + place tokens kept (unlike normalizeName which drops cp/cup/mtb).
 */
export function canonicalizeForDedup(name: string): string {
  let s = fold(name);
  const aliasHits: string[] = [];
  for (const rule of SERIES_ALIAS_RULES) {
    if (rule.re.test(s)) {
      aliasHits.push(rule.token);
      s = s.replace(rule.re, " ");
    }
  }
  s = s
    .replace(/\b\d{1,2}\.\s*/g, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(NOISE_WORDS, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...aliasHits, s].filter(Boolean).join(" ").trim();
}

export function seriesAliasTokens(name: string): string[] {
  const s = fold(name);
  return SERIES_ALIAS_RULES.filter((r) => r.re.test(s)).map((r) => r.token);
}

/** Titles that are basically just a UCI class / empty after cleaning. */
export function isWeakRaceName(name: string): boolean {
  const folded = fold(name)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!folded || folded.length < 4) return true;
  if (/^(uci\s*)?(hc|c[1-3]|cdm)$/i.test(folded)) return true;
  if (/^(uci\s*c[1-3]|uci\s*hc)$/i.test(folded)) return true;
  if (/^(uci mtb world cup|nmnm|vimperk|bedrichov)$/.test(folded)) return true;
  const canon = canonicalizeForDedup(name);
  return !canon || canon.length < 3;
}

/** Dice coefficient on character bigrams */
export function nameSimilarity(a: string, b: string): number {
  const x = canonicalizeForDedup(a) || normalizeName(a);
  const y = canonicalizeForDedup(b) || normalizeName(b);
  return dice(x, y);
}

function dice(x: string, y: string): number {
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bigrams = (s: string) => {
    const out: string[] = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  };
  const A = bigrams(x);
  const B = bigrams(y);
  if (!A.length || !B.length) return 0;
  let inter = 0;
  const pool = [...B];
  for (const g of A) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      inter += 1;
      pool.splice(i, 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function placeTokens(...places: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const p of places) {
    if (!p) continue;
    for (const w of fold(p)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4)) {
      out.add(w);
    }
  }
  return [...out];
}

/** Canonical title with venue words stripped so "Blovice - DÚŠA KAP" ≈ "5. TalentCUP: DÚŠA KAP". */
function coreCanonical(ev: DedupEvent, other: DedupEvent): string {
  let s = fold(ev.name);
  for (const tok of placeTokens(ev.placeText, other.placeText)) {
    s = s.replace(new RegExp(`\\b${escapeRe(tok)}\\b`, "g"), " ");
  }
  const blob = ev.seriesName ? `${s} ${fold(ev.seriesName)}` : s;
  return canonicalizeForDedup(blob);
}

function parseDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(parseDay(a) - parseDay(b));
}

type DateSpan = { startDate: string; endDate?: string | null };

/** Intervals touch or gap ≤ maxGap days (covers Sat+Sun multi-day cups). */
export function datesCompatible(a: DateSpan, b: DateSpan, maxGap = 1): boolean {
  const a0 = parseDay(a.startDate);
  const a1 = parseDay(a.endDate || a.startDate);
  const b0 = parseDay(b.startDate);
  const b1 = parseDay(b.endDate || b.startDate);
  const lo = Math.min(a0, a1);
  const hi = Math.max(a0, a1);
  const lo2 = Math.min(b0, b1);
  const hi2 = Math.max(b0, b1);
  if (hi < lo2) return lo2 - hi <= maxGap;
  if (hi2 < lo) return lo - hi2 <= maxGap;
  return true;
}

export function isGarbagePlace(place?: string | null): boolean {
  const p = fold(place || "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return !p || /^(uci\s*(c[123]|cn|hc)|unknown|silnice)$/.test(p);
}

export function placesNearby(
  a: { lat?: number | null; lng?: number | null; placeText?: string | null },
  b: { lat?: number | null; lng?: number | null; placeText?: string | null },
  maxKm = 25,
): boolean {
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    return distanceKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= maxKm;
  }
  const pa = fold(a.placeText || "").replace(/[^a-z0-9\s]/g, " ").trim();
  const pb = fold(b.placeText || "").replace(/[^a-z0-9\s]/g, " ").trim();
  if (!pa || !pb || isGarbagePlace(pa) || isGarbagePlace(pb)) return false;
  const ta = pa.split(/\s+/).filter((w) => w.length >= 4);
  const tb = pb.split(/\s+/).filter((w) => w.length >= 4);
  return ta.some((w) => pb.includes(w)) || tb.some((w) => pa.includes(w));
}

export type DedupEvent = {
  startDate: string;
  endDate?: string | null;
  name: string;
  lat?: number | null;
  lng?: number | null;
  placeText?: string | null;
  seriesName?: string | null;
  fingerprint?: string;
  /** website / registration / race-detail source URLs (not calendar roots) */
  urls?: (string | null | undefined)[];
};

export type DedupScore = {
  score: number;
  reasons: string[];
};

/**
 * Multi-signal score. Signals: fingerprint, URL, date, place, name/alias.
 * Merge when score ≥ {@link DEDUP_THRESHOLD}.
 */
export const DEDUP_THRESHOLD = 50;

export function scoreDuplicate(a: DedupEvent, b: DedupEvent): DedupScore {
  const reasons: string[] = [];
  let score = 0;

  if (a.fingerprint && b.fingerprint && a.fingerprint === b.fingerprint) {
    return { score: 100, reasons: ["fingerprint"] };
  }

  const sameUrl = urlsOverlap(a.urls, b.urls);
  const datesOk = datesCompatible(a, b, 1);
  const sameDay = a.startDate.slice(0, 10) === b.startDate.slice(0, 10);
  let near = placesNearby(a, b);
  const ca = coreCanonical(a, b);
  const cb = coreCanonical(b, a);
  const sim = Math.max(nameSimilarity(a.name, b.name), dice(ca, cb));
  const aliasesA = seriesAliasTokens(`${a.name} ${a.seriesName ?? ""}`);
  const aliasesB = seriesAliasTokens(`${b.name} ${b.seriesName ?? ""}`);
  const sharedAlias = aliasesA.some((t) => aliasesB.includes(t));
  const weakA = isWeakRaceName(a.name);
  const weakB = isWeakRaceName(b.name);

  // Distinct formats at the same venue/weekend (XCO vs biatlon, DH vs XCM, …)
  if (!sameUrl && formatConflict(a.name, b.name)) {
    return { score: 0, reasons: ["format_conflict"] };
  }

  // Women's race vs open/men's race the same day (UMAG/Poreč Classic)
  if (!sameUrl && genderConflict(a.name, b.name)) {
    return { score: 0, reasons: ["gender_conflict"] };
  }

  // Distinct named series at the same venue (Kids Cup vs iXS DHC, AYC vs MLA, …)
  if (aliasesA.length && aliasesB.length && !sharedAlias) {
    return { score: 0, reasons: ["series_conflict"] };
  }

  if (
    !near &&
    datesOk &&
    (isGarbagePlace(a.placeText) || isGarbagePlace(b.placeText)) &&
    (sharedAlias || sim >= 0.55 || weakA || weakB)
  ) {
    near = true;
    reasons.push("place_unknown_same_weekend");
  }

  // --- URL (strong, but still need plausible dates for multi-year reuse of pages)
  if (sameUrl) {
    score += 45;
    reasons.push("same_url");
    if (datesOk) {
      score += 20;
      reasons.push("dates_ok");
    } else if (daysBetween(a.startDate, b.startDate) <= 3) {
      score += 10;
      reasons.push("dates_near");
    }
  }

  // --- Date
  if (!sameUrl) {
    if (!datesOk) {
      return { score: 0, reasons: ["dates_too_far"] };
    }
    score += sameDay ? 18 : 12;
    reasons.push(sameDay ? "same_day" : "weekend");
  } else if (datesOk && !reasons.includes("dates_ok")) {
    score += 12;
    reasons.push("dates_ok");
  }

  // --- Place
  if (near) {
    score += 22;
    reasons.push("same_place");
  }

  // --- Name / series
  if (ca && cb && ca === cb) {
    score += 28;
    reasons.push("same_canonical_name");
  } else if (sharedAlias && near && sameDay) {
    // Same series + venue + day (Hynek listing vs official calendar).
    // Consecutive cup rounds share branding — do not merge across the weekend.
    score += 24;
    reasons.push("series_alias");
  } else if (sharedAlias) {
    score += 8;
    reasons.push("series_alias_weak");
  } else if (sim >= 0.88) {
    score += 26;
    reasons.push("name_sim_high");
  } else if (sim >= 0.55) {
    score += 14;
    reasons.push("name_sim_mid");
  } else if (sim >= 0.35) {
    score += 6;
    reasons.push("name_sim_low");
  }

  // Weak title ("UCI C1") absorbed into richer title at same place/weekend
  if (near && datesOk && (weakA || weakB)) {
    const strong = fold(weakA ? b.name : a.name);
    const weak = fold(weakA ? a.name : b.name);
    if (
      strong.includes(weak) ||
      (/uci\s*c[1-3]|uci\s*hc/.test(strong) && /uci\s*c[1-3]|uci\s*hc/.test(weak))
    ) {
      score += 18;
      reasons.push("weak_name_absorbed");
    }
  }

  // Substring fallback
  const na = normalizeName(a.name);
  const nb = normalizeName(b.name);
  if (
    near &&
    na &&
    nb &&
    (na.includes(nb) || nb.includes(na)) &&
    Math.min(na.length, nb.length) >= 6 &&
    !reasons.includes("same_canonical_name")
  ) {
    score += 10;
    reasons.push("name_substring");
  }

  // Name-only matches without place/URL are too risky
  if (!near && !sameUrl && score < 70) {
    score = Math.min(score, DEDUP_THRESHOLD - 1);
    reasons.push("needs_place_or_url");
  }

  return { score, reasons };
}

export function isLikelyDuplicate(a: DedupEvent, b: DedupEvent): boolean {
  return scoreDuplicate(a, b).score >= DEDUP_THRESHOLD;
}

/** Conflicting race-format tokens → not the same event even at one venue. */
const FORMAT_TOKENS = [
  "biatlon",
  "xco",
  "xcm",
  "xcc",
  "dh",
  "downhill",
  "enduro",
  "gravel",
  "cyclo",
  "casovka",
  "časovka",
  "eliminator",
  "eliminátor",
  "short track",
  "maraton",
] as const;

export function formatConflict(aName: string, bName: string): boolean {
  const fa = fold(aName);
  const fb = fold(bName);
  const ta = FORMAT_TOKENS.filter((t) => fa.includes(fold(t)));
  const tb = FORMAT_TOKENS.filter((t) => fb.includes(fold(t)));
  if (!ta.length || !tb.length) return false;
  return !ta.some((t) => tb.includes(t));
}

function genderConflict(aName: string, bName: string): boolean {
  const lady = /\b(ladies|women|donne|žen|zeny|femminile|female)\b/i;
  return lady.test(aName) !== lady.test(bName);
}

/** Prefer a human-useful title over class-only or English stub. */
export function preferEventName(a: string, b: string): string {
  const score = (n: string) => {
    let s = n.trim().length;
    if (isWeakRaceName(n)) s -= 40;
    if (/^\d{1,2}\.\s/.test(n.trim())) s -= 35;
    if (seriesAliasTokens(n).length) s += 25;
    if (/[áčďéěíňóřšťúůýž]/i.test(n) || /\bčp\b/i.test(n)) s += 8;
    if (/\bostrava|praha|brno|plzen|liberec\b/i.test(n)) s += 10;
    return s;
  };
  return score(a) >= score(b) ? a : b;
}

export function mergeDateSpan(a: DateSpan, b: DateSpan): { startDate: string; endDate: string } {
  const dates = [a.startDate, a.endDate || a.startDate, b.startDate, b.endDate || b.startDate]
    .filter(Boolean)
    .map((d) => d!.slice(0, 10))
    .sort();
  return { startDate: dates[0], endDate: dates[dates.length - 1] };
}

/** Prefer higher race classification when merging. */
const LEVEL_RANK: Record<string, number> = {
  local: 1,
  regional: 2,
  national: 3,
  continental: 4,
  international: 5,
  world_cup: 6,
  european_championship: 7,
  world_championship: 8,
};

export function preferLevel(
  a: { level?: string | null; uciClass?: string | null; classLabel?: string | null },
  b: { level?: string | null; uciClass?: string | null; classLabel?: string | null },
): { level: string; uciClass: string | null; classLabel: string | null } {
  const ra = LEVEL_RANK[a.level || ""] ?? 0;
  const rb = LEVEL_RANK[b.level || ""] ?? 0;
  const winner = ra >= rb ? a : b;
  return {
    level: winner.level || "local",
    uciClass: a.uciClass || b.uciClass || null,
    classLabel: a.classLabel || b.classLabel || winner.classLabel || null,
  };
}
