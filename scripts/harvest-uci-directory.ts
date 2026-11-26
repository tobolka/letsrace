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
const RIDE = /velotour|jedermann|brezel\s+race|gran\s*fondo|granfondo|cicloturist|sportive|hobby|rtf\b|ctf\b|volksrad/i;
const words = (text: string) => new Set((fold(text).match(/[a-z0-9]{4,}/g) ?? []).filter((w) => !GENERIC.has(w)));

type Row = import("../src/lib/catalog/uci-directory").UciCatalogRow;

async function main() {
  for (const [key, value] of Object.entries(parse(readFileSync(".env.local")))) process.env[key] ??= value;
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const apply = process.argv.includes("--apply");
  const out = arg("out");
  const ucd = await import("../src/lib/catalog/uci-directory");
  const { eventDisciplineFamily } = await import("../src/lib/taxonomy");
  const { saveFoundLinks, savePracticalDetails } = await import("../src/lib/catalog/practical-enrichment");
  const { saveCandidate } = await import("../src/lib/discovery/review");
  const { validateReviewSource } = await import("../src/lib/discovery/review-source");
  const { ingestReviewedCandidate } = await import("../src/lib/watcher/run");
  const { catalogueWindow } = await import("../src/lib/catalog/overview-quality");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  const countries = (arg("countries") ?? Object.keys(ucd.UCI_DIRECTORY_COUNTRIES).join(",")).split(",");
  const ids = arg("ids")?.split(",").filter(Boolean);
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));

  // The directory, then each competition's own record with its races.
  const listed: import("../src/lib/catalog/uci-directory").UciDirectoryCompetition[] = [];
  const listFailures: { target: string; error: string }[] = [];
  let listAttempts = 0;
  if (ids?.length) {
    for (const id of ids) {
      listAttempts++;
      try { listed.push(await ucd.readUciDirectoryCompetition(id)); } catch (e) {
        const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
        listFailures.push({ target: id, error: message });
        console.log(`  ! ${id}: ${message}`);
      }
    }
  } else {
    for (const country of countries) for (const season of [year, year + 1]) {
      listAttempts++;
      try {
        listed.push(...(await ucd.listUciDirectory(season, country)).filter((c) => (c.endDate ?? c.startDate) >= today));
      } catch (e) {
        const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
        listFailures.push({ target: `${country}/${season}`, error: message });
        console.log(`  ! ${country} ${season}: ${message}`);
      }
      await wait(300);
    }
  }
  if (listAttempts > 0 && listFailures.length === listAttempts && listed.length === 0) {
    throw Error(`UCI directory unavailable (${listFailures[0]!.target}: ${listFailures[0]!.error})`);
  }
  const unique = [...new Map(listed.map((c) => [c.id, c])).values()];
  console.log(`UCI adresář: ${unique.length} soutěží ke kontrole (${countries.join(", ")})`);

  // The catalogue in the same window, hidden and merged races included: someone may have ruled a race out.
  const rows: Row[] = [];
  const last = unique.reduce((max, c) => ((c.endDate ?? c.startDate) > max ? (c.endDate ?? c.startDate) : max), today);
  const first = unique.reduce((min, c) => c.startDate < min ? c.startDate : min, today);
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("events")
      .select("id,slug,name,start_date,end_date,visibility,status,merged_into_id,level,uci_class,disciplines,website_url,registration_url,regulations_url,results_url,age_categories,age_confidence,audience,public_revision,practical_details,location:locations(municipality,country_code),sources:event_sources(source_url,external_id),overrides:event_overrides(locked_fields)")
      .gte("end_date", addDays(first, -40)).lte("start_date", addDays(last, 2)).order("start_date").order("id").range(from, from + 999)
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

  const report: Record<string, unknown>[] = listFailures.map((f) => ({ target: f.target, outcome: "list-failed", error: f.error }));
  const publishedThisRun = new Set<string>();
  /** Unresolved: into the shared review queue, unpublished, with what a person has to settle. */
  const queue = async (event: import("../src/lib/domain").ParsedEvent, competition: import("../src/lib/catalog/uci-directory").UciDirectoryCompetition, reason: string) => {
    if (!apply) return;
    const body = JSON.stringify(competition);
    await saveCandidate(db, event, { sourceUrl: event.sourceUrl, documentHash: hash(body), textHash: hash(body), reason: `UCI Competition Directory — ${reason}`.slice(0, 500), country: event.countryHint }).catch(() => null);
  };
  const stats = { competitions: unique.length, skipped: 0, matched: 0, enriched: 0, published: 0, ambiguous: 0, ruledOut: 0, failed: listFailures.length };
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
        }).filter((m) => isWomen(m.r.name) === isWomen(event.name)).map((m) => ({ ...m, score: m.score + (m.r.uci_class && event.uciClass && m.r.uci_class === event.uciClass ? 1 : 0) })).filter((m) => m.score > 0).sort((a, b) => b.score - a.score);
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
    // A hidden twin of a public race is no rival: the public one is the race the UCI entry is about.
    const unmerged = matches.filter((m) => !m.r.merged_into_id);
    const live = unmerged.some((m) => m.r.visibility === "public") ? unmerged.filter((m) => m.r.visibility === "public") : unmerged;
    const best = live[0];
    const line = { uci: competition.id, name: event.name, date: start, class: competition.classCode, country: cc };
    // Several UCI entries of one weekend (the men's, the women's, the juniors') may share one catalogue race: only a weak
    // name match makes another entry a rival for it.
    const rivals = best && best.score < 3 ? (claims.get(best.r.id) ?? []).filter((c) => c.read !== read) : [];
    const contested = best && best.score < 100 && (live.some((m) => m.score === best.score && m.r.id !== best.r.id) || rivals.some((c) => c.score >= best.score));
    if (contested) {
      stats.ambiguous++; report.push({ ...line, outcome: "ambiguous", candidates: [...new Set([...live.slice(0, 3).map((m) => m.r.slug), ...rivals.map((c) => c.read.event.name)])] });
      await queue(event, competition, `unclear match: ${live.slice(0, 3).map((m) => m.r.slug).join(", ")}${rivals.length ? `; also claimed by ${rivals.map((c) => c.read.event.name).join("; ")}` : ""}`);
      console.log(`  ? ${start} ${event.name.slice(0, 50)} — nejasné: ${live.slice(0, 3).map((m) => m.r.slug).join(", ")}${rivals.length ? ` (o tentýž závod se hlásí i ${rivals.map((c) => c.read.event.name).join("; ")})` : ""}`);
      continue;
    }
    if (!best && matches.length) { stats.ruledOut++; report.push({ ...line, outcome: "merged", slug: matches[0]!.r.slug }); continue; }
    if (best) {
      const r = best.r;
      if (r.visibility !== "public") { stats.matched++; stats.ruledOut++; report.push({ ...line, outcome: "hidden", slug: r.slug }); continue; }
      try {
        const changes = await enrich(r, read);
        stats.matched++;
        if (changes.length) stats.enriched++;
        report.push({ ...line, outcome: changes.length ? "enriched" : "same", slug: r.slug, changes });
        console.log(`  = ${start} ${event.name.slice(0, 44)} → ${r.slug}${changes.length ? ` [${changes.join(", ")}]` : ""}`);
      } catch (failure) {
        stats.failed++;
        const message = (failure instanceof Error ? failure.message : String(failure)).slice(0, 300);
        report.push({ ...line, outcome: "failed", slug: r.slug, error: message });
        console.log(`  ! ${start} ${event.name.slice(0, 44)} → ${r.slug}: ${message.slice(0, 180)}`);
      }
      continue;
    }
    // The same name in the same discipline within a few days ("Czech Tour", whose words are all generic) is this race.
    const family = eventDisciplineFamily(event.discipline);
    const named = rows.filter((r) => !r.merged_into_id && eventDisciplineFamily(r.disciplines ?? []) === family && Math.abs(Date.parse(r.start_date) - Date.parse(start)) <= 3 * 86400000
      && isWomen(r.name) === isWomen(event.name)
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
  function enrich(r: Row, { competition, event }: Read): Promise<string[]> {
    return ucd.enrichUciCatalogRow(r, { competition, event }, {
      apply,
      async updateEvent(id, revision, patch, facts) {
        const { data: updated, error } = await db.from("events").update(patch).eq("id", id).eq("public_revision", revision).select("id,public_revision");
        if (error) throw Error(error.message);
        if (updated?.length !== 1) throw Error("Catalogue changed while enriching the UCI competition");
        const { error: factError } = await db.from("event_facts").insert(facts as never);
        if (factError) throw factError;
        return updated[0]!.public_revision;
      },
      async insertSource(eventId, sourceUrl, externalId) {
        const { error } = await db.from("event_sources").insert({ event_id: eventId, source_url: sourceUrl, external_id: externalId, is_canonical: false, kind: "official" });
        if (error && error.code !== "23505") throw Error(error.message);
      },
      async saveWebsite(row, website) {
        return (await saveFoundLinks(row, { website })) > 0;
      },
      async readRevision(eventId) {
        const { data, error } = await db.from("events").select("public_revision").eq("id", eventId).single();
        if (error) throw Error(error.message);
        return data?.public_revision ?? null;
      },
      savePracticalDetails,
    });
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

/** The women's and the men's race of one town share a name but are two competitions. */
const isWomen = (name: string) => /\b(women|woman|donne|donna|femmes?|frauen|feminin\w*|féminin\w*|damen|ladies|kobiety|ženy)\b/i.test(name);

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
