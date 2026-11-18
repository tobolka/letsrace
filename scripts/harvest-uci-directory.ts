/**
 * The UCI Competition Directory for our countries: every UCI-registered competition this season and next.
 * A competition the catalogue has gets what it lacks (the UCI source, class, level, website, UCI categories,
 * the organiser's e-mail); one it lacks is published through the reviewed-candidate gates.
 * Unclear matches are left out and listed. Dry unless --apply.
 *
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/harvest-uci-directory.ts [--apply] [--countries=CZE,SVK] [--out=report.json]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const fold = (text: string) => text.toLowerCase().replaceAll("ß", "ss").replaceAll("ł", "l").normalize("NFD").replace(/\p{M}/gu, "");
// Words every second race name has: they say nothing about which race it is.
const GENERIC = new Set(["cross", "cyclo", "cyclocross", "ciclocross", "cyklokros", "race", "rennen", "grand", "prix", "tour", "trophy", "trofeo", "memorial", "memoriale",
  "international", "internazionale", "internationaler", "cup", "coppa", "pohar", "round", "series", "serie", "world", "mountain", "bike", "junior", "juniors", "juniores", "elite",
  "road", "women", "woman", "men", "uci", "gara", "giro", "preis", "class", "continental", "championships", "championship", "campionato", "mistrovstvi", "meisterschaft",
  "national", "nazionale", "european", "europe", "edition", "edizione", "classic", "classica", "stage", "etappe", "kolo", "2026", "2027", "2028", "under", "para", "cycling", "ciclismo",
  "cyclisme", "cykliste", "radsport", "track", "bmx", "racing", "open", "dalla", "della", "delle", "degli", "city", "citta",
  // Country words name half the calendar of a country.
  "czech", "czechia", "republic", "slovak", "slovakia", "slovensko", "polska", "poland", "polish", "italia", "italy", "italian", "italiana", "austria", "osterreich",
  "germany", "deutschland", "german", "deutsche", "gran", "premio", "festival"]);
// The amateur ride beside a professional race ("ADAC Velotour Eschborn-Frankfurt") is another event.
const RIDE = /velotour|jedermann|gran\s*fondo|granfondo|cicloturist|sportive|hobby|rtf\b|ctf\b|volksrad/i;
const words = (text: string) => new Set((fold(text).match(/[a-z0-9]{4,}/g) ?? []).filter((w) => !GENERIC.has(w)));
const AGE_FIELDS = ["age_categories", "age_confidence", "audience"];

type Row = {
  id: string; slug: string; name: string; start_date: string; end_date: string | null; visibility: string; status: string | null; merged_into_id: string | null;
  level: string | null; uci_class: string | null; website_url: string | null; registration_url: string | null; regulations_url: string | null; results_url: string | null;
  age_categories: string[] | null; age_confidence: string | null; public_revision: string; practical_details: Record<string, unknown> | null;
  disciplines: string[] | null; location: { municipality: string | null; country_code: string | null } | null; sources: { source_url: string | null; external_id: string | null }[];
  overrides: { locked_fields: string[] | null } | null;
};

async function main() {
  for (const [key, value] of Object.entries(parse(readFileSync(".env.local")))) process.env[key] ??= value;
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const apply = process.argv.includes("--apply");
  const out = arg("out");
  const ucd = await import("../src/lib/catalog/uci-directory");
  const { audienceFromAgeCategories, AGE_CATEGORIES, levelAtLeast, eventDisciplineFamily } = await import("../src/lib/taxonomy");
  const { saveFoundLinks, savePracticalDetails } = await import("../src/lib/catalog/practical-enrichment");
  const { saveCandidate } = await import("../src/lib/discovery/review");
  const { validateReviewSource } = await import("../src/lib/discovery/review-source");
  const { ingestReviewedCandidate } = await import("../src/lib/watcher/run");
  const { catalogueWindow } = await import("../src/lib/catalog/overview-quality");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  const countries = (arg("countries") ?? Object.keys(ucd.UCI_DIRECTORY_COUNTRIES).join(",")).split(",");
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));

  // The directory, then each competition's own record with its races.
  const listed: import("../src/lib/catalog/uci-directory").UciDirectoryCompetition[] = [];
  for (const country of countries) for (const season of [year, year + 1]) {
    listed.push(...(await ucd.listUciDirectory(season, country)).filter((c) => (c.endDate ?? c.startDate) >= today));
    await wait(300);
  }
  const unique = [...new Map(listed.map((c) => [c.id, c])).values()];
  console.log(`UCI adresář: ${unique.length} nadcházejících soutěží (${countries.join(", ")})`);

  // The catalogue in the same window, hidden and merged races included: someone may have ruled a race out.
  const rows: Row[] = [];
  const last = unique.reduce((max, c) => ((c.endDate ?? c.startDate) > max ? (c.endDate ?? c.startDate) : max), today);
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("events")
      .select("id,slug,name,start_date,end_date,visibility,status,merged_into_id,level,uci_class,disciplines,website_url,registration_url,regulations_url,results_url,age_categories,age_confidence,public_revision,practical_details,location:locations(municipality,country_code),sources:event_sources(source_url,external_id),overrides:event_overrides(locked_fields)")
      .gte("end_date", addDays(today, -40)).lte("start_date", addDays(last, 2)).order("start_date").order("id").range(from, from + 999)
      .returns<Row[]>();
    if (error) throw Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }

  // Places we know, per country: a new race is placed only where the directory names a real town.
  const towns = new Map<string, Set<string>>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("locations").select("municipality,country_code").not("municipality", "is", null).range(from, from + 999);
    if (error) throw Error(error.message);
    for (const l of data ?? []) { const set = towns.get(l.country_code ?? "") ?? new Set<string>(); set.add(fold(l.municipality!).trim()); towns.set(l.country_code ?? "", set); }
    if ((data ?? []).length < 1000) break;
  }
  const normalized = (text: string) => fold(text).replace(/[^a-z0-9]+/g, " ").replace(/\b(20\d\d|uci)\b/g, " ").replace(/\s+/g, " ").trim();

  const report: Record<string, unknown>[] = [];
  const publishedThisRun = new Set<string>();
  /** Unresolved: into the shared review queue, unpublished, with what a person has to settle. */
  const queue = async (event: import("../src/lib/domain").ParsedEvent, competition: import("../src/lib/catalog/uci-directory").UciDirectoryCompetition, reason: string) => {
    if (!apply) return;
    const body = JSON.stringify(competition);
    await saveCandidate(db, event, { sourceUrl: event.sourceUrl, documentHash: hash(body), textHash: hash(body), reason: `UCI Competition Directory — ${reason}`.slice(0, 500), country: event.countryHint }).catch(() => null);
  };
  const stats = { competitions: unique.length, skipped: 0, matched: 0, enriched: 0, published: 0, ambiguous: 0, ruledOut: 0, failed: 0 };
  // First every competition and the races it could be; nothing is written until all are known.
  type Read = { competition: import("../src/lib/catalog/uci-directory").UciDirectoryCompetition; event: import("../src/lib/domain").ParsedEvent; matches: { r: Row; score: number }[]; sameDay: Row[] };
  const reads: Read[] = [];
  for (const item of unique) {
    let competition: import("../src/lib/catalog/uci-directory").UciDirectoryCompetition;
    try { competition = await ucd.readUciDirectoryCompetition(item.id); } catch (e) { stats.failed++; console.log(`  ! ${item.name}: ${(e as Error).message}`); continue; }
    await wait(250);
    const event = ucd.uciDirectoryEvent(competition);
    if (!event) { stats.skipped++; continue; }
    const cc = event.countryHint!;
    const start = event.startDate, end = event.endDate ?? event.startDate;
    const family = eventDisciplineFamily(event.discipline);
    const ownName = words(event.name), place = words(event.placeText);
    const linked = rows.filter((r) => r.sources.some((s) => s.external_id === event.externalId || ucd.uciDirectoryId(s.source_url) === competition.id));
    // Same country, same discipline, overlapping days; a ride is never a race; a race of another UCI class is another race.
    const near = rows.filter((r) => (r.location?.country_code ?? cc) === cc && r.start_date <= addDays(end, 1) && (r.end_date ?? r.start_date) >= addDays(start, -1)
      && eventDisciplineFamily(r.disciplines ?? []) === family && (RIDE.test(r.name) === RIDE.test(event.name))
      && (!r.uci_class || !event.uciClass || r.uci_class === event.uciClass));
    const scored = linked.length ? linked.map((r) => ({ r, score: 100 }))
      : near.map((r) => {
          const theirs = words(r.name), town = words(r.location?.municipality ?? "");
          const named = [...theirs].filter((w) => ownName.has(w) && !place.has(w)).length;
          const placed = [...theirs, ...town].some((w) => place.has(w)) ? 1 : 0;
          const exact = r.start_date === start;
          // The whole name ("Czech Tour" in "LIDL Czech Tour") is the strongest sign there is.
          const ours = normalized(event.name), theirName = normalized(r.name);
          const whole = ours.length >= 6 && (theirName === ours || theirName.includes(ours) || ours.includes(theirName) && theirName.length >= 6) ? 3 : 0;
          // A shared name word counts; the place alone only on the very day.
          return { r, score: named || whole ? named * 2 + whole + placed + (exact ? 1 : 0) : placed && exact ? 1 : 0 };
        }).filter((m) => m.score > 0).sort((a, b) => b.score - a.score);
    const sameDay = rows.filter((r) => !r.merged_into_id && (r.location?.country_code ?? cc) === cc && r.start_date === start && eventDisciplineFamily(r.disciplines ?? []) === family
      && [...words(`${r.name} ${r.location?.municipality ?? ""}`)].some((w) => place.has(w)));
    reads.push({ competition, event, matches: scored, sameDay });
  }
  // One catalogue race is one competition: when several claim it, only a clear best keeps it.
  const claims = new Map<string, { read: Read; score: number }[]>();
  for (const read of reads) { const best = read.matches.find((m) => !m.r.merged_into_id); if (best) claims.set(best.r.id, [...(claims.get(best.r.id) ?? []), { read, score: best.score }]); }

  for (const read of reads) {
    const { competition, event, matches, sameDay } = read;
    const cc = event.countryHint!, start = event.startDate;
    const live = matches.filter((m) => !m.r.merged_into_id);
    const best = live[0];
    const line = { uci: competition.id, name: event.name, date: start, class: competition.classCode, country: cc };
    const rivals = best ? (claims.get(best.r.id) ?? []).filter((c) => c.read !== read) : [];
    const contested = best && best.score < 100 && (live.some((m) => m.score === best.score && m.r.id !== best.r.id) || rivals.some((c) => c.score >= best.score));
    if (contested) {
      stats.ambiguous++; report.push({ ...line, outcome: "ambiguous", candidates: [...new Set([...live.slice(0, 3).map((m) => m.r.slug), ...rivals.map((c) => c.read.event.name)])] });
      await queue(event, competition, `unclear match: ${live.slice(0, 3).map((m) => m.r.slug).join(", ")}${rivals.length ? `; also claimed by ${rivals.map((c) => c.read.event.name).join("; ")}` : ""}`);
      console.log(`  ? ${start} ${event.name.slice(0, 50)} — nejasné: ${live.slice(0, 3).map((m) => m.r.slug).join(", ")}${rivals.length ? ` (o tentýž závod se hlásí i ${rivals.map((c) => c.read.event.name).join("; ")})` : ""}`);
      continue;
    }
    if (!best && matches.length) { stats.ruledOut++; report.push({ ...line, outcome: "merged", slug: matches[0]!.r.slug }); continue; }
    if (best) {
      stats.matched++;
      const r = best.r;
      if (r.visibility !== "public") { stats.ruledOut++; report.push({ ...line, outcome: "hidden", slug: r.slug }); continue; }
      const changes = await enrich(r, read);
      if (changes.length) stats.enriched++;
      report.push({ ...line, outcome: changes.length ? "enriched" : "same", slug: r.slug, changes });
      console.log(`  = ${start} ${event.name.slice(0, 44)} → ${r.slug}${changes.length ? ` [${changes.join(", ")}]` : ""}`);
      continue;
    }
    // The same name in the same discipline within a few days ("Czech Tour", whose words are all generic) is this race.
    const family = eventDisciplineFamily(event.discipline);
    const named = rows.filter((r) => !r.merged_into_id && eventDisciplineFamily(r.disciplines ?? []) === family && Math.abs(Date.parse(r.start_date) - Date.parse(start)) <= 3 * 86400000
      && (normalized(r.name) === normalized(event.name) || (normalized(event.name).length >= 8 && normalized(r.name).includes(normalized(event.name)))));
    if (named.length) {
      stats.ambiguous++; report.push({ ...line, outcome: "possible-duplicate", candidates: named.map((r) => r.slug) });
      await queue(event, competition, `possible duplicate (same name): ${named.map((r) => r.slug).join(", ")}`);
      console.log(`  ? ${start} ${event.name.slice(0, 50)} — stejný název: ${named.map((r) => r.slug).join(", ")}`);
      continue;
    }
    // A street, a hotel, a region or "TBC" is no place to put a race on the map: a person places it.
    if (!placeLike(event.placeText, cc, towns)) {
      stats.ambiguous++; report.push({ ...line, outcome: "unplaced", venue: event.placeText });
      await queue(event, competition, `place "${event.placeText}" is not a town: needs the real venue`);
      console.log(`  ? ${start} ${event.name.slice(0, 50)} — místo „${event.placeText}" není obec`);
      continue;
    }
    // A race of the same discipline on that day in that place may be this one under another name: a person decides.
    if (sameDay.length) {
      stats.ambiguous++; report.push({ ...line, outcome: "possible-duplicate", candidates: sameDay.map((r) => r.slug) });
      await queue(event, competition, `possible duplicate (same day and place): ${sameDay.map((r) => r.slug).join(", ")}`);
      console.log(`  ? ${start} ${event.name.slice(0, 50)} — možná už je jako: ${sameDay.map((r) => r.slug).join(", ")}`);
      continue;
    }
    // Two directory entries for one race (the men's and the women's) are one new race.
    const runKey = `${normalized(event.name)}|${start}`;
    if (publishedThisRun.has(runKey)) { report.push({ ...line, outcome: "same-run-duplicate" }); continue; }
    publishedThisRun.add(runKey);
    // Not in the catalogue: publish it through the same gates every reviewed source passes.
    console.log(`  + ${start} ${event.name.slice(0, 50)} | ${event.placeText} ${cc} | ${competition.classCode}${apply ? "" : " (suchý běh)"}`);
    report.push({ ...line, outcome: apply ? "publishing" : "new" });
    if (!apply) continue;
    try {
      const body = JSON.stringify(competition);
      const saved = await saveCandidate(db, event, { sourceUrl: event.sourceUrl, documentHash: hash(body), textHash: hash(body), reason: "Registered on the UCI calendar (UCI Competition Directory)", country: cc });
      if (saved.rejected) throw Error("already rejected");
      const { data: candidate, error: candidateError } = await db.from("pipeline_candidates").select("*").eq("candidate_key", saved.candidate_key).eq("evidence_hash", saved.evidence_hash).single();
      if (candidateError) throw candidateError;
      if (candidate.status === "published") { report[report.length - 1]!.outcome = "already-published"; continue; }
      const review = { id: candidate.id, evidenceHash: candidate.evidence_hash, action: "publish" as const, reason: "The UCI registers this competition: its class, dates and venue.", expectedEventId: null, authority: "official" as const, checked: { identity: true, date: true, place: true, discipline: true, authority: true } };
      await validateReviewSource(candidate, review, catalogueWindow().from);
      const { data: claim, error: claimError } = await db.rpc("pipeline_claim_candidate", { p_id: candidate.id, p_hash: candidate.evidence_hash, p_updated: candidate.updated_at, p_decision: review as never, p_retry_resolved: false });
      if (claimError) throw claimError;
      const receipt = claim as { status?: string; token?: string } | null;
      if (!receipt?.token || receipt.status !== "publishing") throw Error("not claimed");
      await ingestReviewedCandidate(candidate, review, { id: candidate.id, evidenceHash: candidate.evidence_hash, token: receipt.token });
      stats.published++;
      report[report.length - 1]!.outcome = "published";
    } catch (failure) {
      stats.failed++;
      report[report.length - 1]!.outcome = "failed";
      report[report.length - 1]!.error = (failure instanceof Error ? failure.message : String(failure)).slice(0, 300);
      console.log(`    nepovedlo se: ${(failure instanceof Error ? failure.message : String(failure)).slice(0, 180)}`);
    }
  }
  console.log(JSON.stringify(stats));
  if (out) writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), apply, stats, report }, null, 1));

  // Fills what the race lacks; never replaces what someone or a better source set.
  async function enrich(r: Row, { competition, event }: Read): Promise<string[]> {
      const locked = new Set(r.overrides?.locked_fields ?? []);
      const changes: string[] = [];
      const update: { uci_class?: string; level?: string; age_categories?: string[]; audience?: string; age_confidence?: string } = {};
      const uciClass = event!.uciClass;
      if (uciClass && !r.uci_class && !locked.has("uci_class")) { update.uci_class = uciClass; changes.push(`třída ${uciClass}`); }
      const level = ucd.uciDirectoryLevel(competition.classCode);
      if (!locked.has("level") && level !== r.level && levelAtLeast(level, (r.level ?? "local") as never)) { update.level = level; changes.push(`úroveň ${level}`); }
      // The UCI's categories are official; they add to a race's set and never take from it.
      const ages = event!.ageCategories ?? [];
      const previous = r.age_categories ?? [];
      // A guessed set loses the open and children's classes when the UCI names only licensed ones (a ProSeries
      // stage race has no amateur race); a confirmed set only gains.
      const guessed = r.age_confidence !== "explicit" && r.age_confidence !== "previous";
      const licensedOnly = ages.length > 0 && ages.every((a) => ["elite", "u23", "junior"].includes(a));
      // Not where amateurs ride beside the UCI race (marathons, gran fondos), nor where the regulations were read:
      // those govern the set.
      const massStart = (event!.discipline ?? []).some((d) => ["xcm", "gran_fondo", "gravel"].includes(d)) || /marathon|maraton|fondo|gravel/i.test(`${event!.name} ${r.name}`);
      const regulationsRead = ["categories", "schedule", "fees"].some((k) => (r.practical_details ?? {})[k] && !String(((r.practical_details ?? {})[k] as { quote?: string }).quote ?? "").startsWith("UCI Competition Directory"));
      // At a world cup or a championship the youth classes are guessed too: such a meeting runs the UCI's categories.
      const championship = levelAtLeast(ucd.uciDirectoryLevel(competition.classCode) === "international" ? r.level : ucd.uciDirectoryLevel(competition.classCode), "world_cup");
      const dropped = guessed && licensedOnly && !massStart && !regulationsRead
        ? ["amateur", "masters", "kids", "u7", "u9", "u11", ...(championship ? ["youth", "u13", "u15", "u17"] : [])] : [];
      const merged = AGE_CATEGORIES.filter((a) => (previous.includes(a) && !dropped.includes(a)) || ages.includes(a));
      // Every class shown is one the UCI lists for this competition: that is the organiser's word, not a guess.
      const accounted = ages.length > 0 && merged.every((a) => ages.includes(a));
      const confidence = accounted ? "explicit" : previous.length ? r.age_confidence : "default";
      const agesChange = merged.length !== previous.length || merged.some((a) => !previous.includes(a));
      if (ages.length && !AGE_FIELDS.some((f) => locked.has(f)) && (agesChange || confidence !== r.age_confidence)) {
        if (agesChange) { update.age_categories = merged; update.audience = audienceFromAgeCategories(merged); changes.push(`kategorie ${previous.join("/")} → ${merged.join("/")}`); }
        if (confidence !== r.age_confidence) { update.age_confidence = confidence ?? "default"; changes.push(confidence === "explicit" ? "kategorie potvrzené UCI" : "kategorie odhad"); }
      }
      const hasSource = r.sources.some((s) => s.external_id === event!.externalId || ucd.uciDirectoryId(s.source_url) === competition.id);
      if (!hasSource) changes.push("zdroj UCI");
      const pd = r.practical_details ?? {};
      const labels = (event!.categories ?? []).map((c) => c.name);
      const website = event!.websiteUrl ?? null;
      const email = ucd.uciDirectoryEmail(competition.email);
      const needsCategories = labels.length && !pd.categories;
      const needsOrganizer = email && website && !pd.organizer;
      if (needsCategories) changes.push("popisky kategorií");
      if (needsOrganizer) changes.push("e-mail pořadatele");
      if (!apply) {
        if (website && websiteWouldChange(r.website_url) && !locked.has("website_url")) changes.push("web");
        return changes;
      }
      if (Object.keys(update).length) {
        const { error } = await db.from("events").update(update).eq("id", r.id).eq("public_revision", r.public_revision);
        if (error) throw Error(error.message);
        const facts = Object.entries(update).map(([field, value]) => ({ event_id: r.id, field, value: value as never, previous: (r as unknown as Record<string, unknown>)[field] as never ?? null,
          source_url: event!.sourceUrl, quote: event!.evidence!.quote.slice(0, 1500), method: "uci_directory", version: "uci-directory-v2" }));
        await db.from("event_facts").insert(facts);
      }
      if (!hasSource) await db.from("event_sources").insert({ event_id: r.id, source_url: event!.sourceUrl, external_id: event!.externalId, is_canonical: false, kind: "official" });
      if (website && (await saveFoundLinks(r, { website }))) changes.push("web");
      if (needsCategories || needsOrganizer) {
        const { data: fresh } = await db.from("events").select("public_revision").eq("id", r.id).single();
        const checkedAt = new Date().toISOString(), editionYear = Number(event!.startDate.slice(0, 4));
        const quote = `UCI Competition Directory: ${competition.name} · ${labels.join(" · ")}${email ? ` · ${email}` : ""}`.slice(0, 1500);
        const details: import("../src/lib/practical-details").PracticalDetails = {};
        if (needsCategories) details.categories = { sourceUrl: event!.sourceUrl, quote, checkedAt, editionYear, status: "current", value: labels.map((label) => ({ label, sourceUrl: event!.sourceUrl, checkedAt })) };
        if (needsOrganizer) details.organizer = { sourceUrl: event!.sourceUrl, quote, checkedAt, editionYear, status: "current", value: { name: new URL(website!).hostname.replace(/^www\./, ""), url: website!, email: email! } };
        if (fresh) await savePracticalDetails(r.id, fresh.public_revision, details);
      }
      return changes;
  }
}

/** Capitals and towns the directory files under a neighbour (joint championships): another country's place is no place here. */
const FOREIGN: Record<string, RegExp> = { SK: /^(prague|praha)$/i, CZ: /^(nova bana|bratislava)$/i, DE: /^niederwil$/i, AT: /^niederwil$/i };
/** A town, a velodrome or a bike park; not a street, an address, a company, a region or "TBC". */
function placeLike(raw: string, cc: string, towns: Map<string, Set<string>>): boolean {
  const text = fold(raw).trim();
  if (!text || /\d|\/|\(|tbc|date dependent/.test(text)) return false;
  if (FOREIGN[cc]?.test(text)) return false;
  if (/^(road|via|viale|piazza|corso|nad|ulica|ul\.|strasse)\b|\b(hotel|fundacja|headquarters|sede|stabilimento|ssd|srl|s\.r\.l|asd|gmbh|e\.v\.)\b/.test(text)) return false;
  if (/^(emilia-romagna|piemonte|lombardia|veneto|toscana|liguria|trentino|mazowsze|podlasie|malopolska|slaskie|slovensko|bayern|sachsen|tirol|steiermark|morava|cechy)$/.test(text)) return false;
  // Known towns pass; the checks above run first, because the places table holds a few "TBC"s itself.
  return towns.get(cc)?.has(text) || text.length >= 3;
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
/** A calendar's or the UCI's page in the website slot gives way to the organiser's own site. */
function websiteWouldChange(current: string | null) {
  return !current || /uci\.org|federciclismo|rideandrest|radsport-events|rad-net|pzkol|cyklokros\.cz\/kalendar/i.test(current);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
