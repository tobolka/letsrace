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
  { re: /\btalent\s*cup\b/i, token: "series:talent_cup" },
  { re: /\bkolo\s*pro\b|\bkolopro\b/i, token: "series:kolopro" },
  { re: /\bjunior\s*cup\b/i, token: "series:junior_cup" },
  { re: /\bsport\s*challenge\b/i, token: "series:sport_challenge" },
  { re: /\bworld\s*cup\b|\bswc\b|\bcdm\b/i, token: "series:world_cup" },
];

const NOISE_WORDS =
  /\b(zavod|race|open|memorial|memoria|uci|c1|c2|c3|hc|xco|xcc|xcm|dh|enduro|gravel|road|mtb|cx|bmx|elite|junior|u23|masters|kids|deti|mladez)\b/gi;

/** Calendar roots that must not count as “same URL”. */
const GENERIC_HOST_PATH =
  /^(hynekmusil\.cz|sumator\.cz|mtbs\.cz|radsport-events\.de|eventivsport\.com|velokal\.de|jiskra\.potocky\.cz)(\/(kalendar|sekce\/kalendar|map|race\/?)?)?$/i;

/**
 * Strip tracking noise; hostname + pathname only.
 * Returns empty string for unusable / generic calendar URLs.
 */
export function normalizeUrlForDedup(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    let path = u.pathname.replace(/\/+$/, "") || "";
    // Drop empty or root-only aggregators
    const key = `${host}${path}`.toLowerCase();
    if (GENERIC_HOST_PATH.test(key) || GENERIC_HOST_PATH.test(host)) return "";
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
  const canon = canonicalizeForDedup(name);
  return !canon || canon.length < 3;
}

/** Dice coefficient on character bigrams */
export function nameSimilarity(a: string, b: string): number {
  const x = canonicalizeForDedup(a) || normalizeName(a);
  const y = canonicalizeForDedup(b) || normalizeName(b);
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
  if (!pa || !pb) return false;
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
  const near = placesNearby(a, b);
  const sim = nameSimilarity(a.name, b.name);
  const ca = canonicalizeForDedup(a.name);
  const cb = canonicalizeForDedup(b.name);
  const aliasesA = seriesAliasTokens(a.name);
  const aliasesB = seriesAliasTokens(b.name);
  const sharedAlias = aliasesA.some((t) => aliasesB.includes(t));
  const weakA = isWeakRaceName(a.name);
  const weakB = isWeakRaceName(b.name);

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
  } else if (sharedAlias) {
    score += 24;
    reasons.push("series_alias");
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

/** Prefer a human-useful title over class-only or English stub. */
export function preferEventName(a: string, b: string): string {
  const score = (n: string) => {
    let s = n.trim().length;
    if (isWeakRaceName(n)) s -= 40;
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
  international: 4,
  european_championship: 5,
  world_championship: 6,
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
