/**
 * iprimacup.cz publishes every round on one template: date and venue at the top,
 * courses with distance and elevation under "Trasy závodu", venue and parking under
 * "Místo a zázemí", tiered CZK fees under "Startovné", timetable under "Časový
 * harmonogram", and age classes under "Vypsané kategorie". Reading the template needs
 * no guessing and no AI; every fact still passes `verifyPracticalExtraction`.
 */
const clean = (text: string) => text.replace(/\s+/g, " ").trim();

export const isPrimaCupRoundUrl = (url: string): boolean =>
  /^https?:\/\/(?:www\.)?iprimacup\.cz\/\d{2}-[a-z0-9-]+\/?$/i.test(url);

const CZECH_MONTHS: Record<string, string> = {
  leden: "01", ledna: "01", lednu: "01",
  unor: "02", unora: "02", unoru: "02",
  brezen: "03", brezna: "03", breznu: "03",
  duben: "04", dubna: "04", dubnu: "04",
  kveten: "05", kvetna: "05", kvetnu: "05",
  cerven: "06", cervna: "06", cervnu: "06",
  cervenec: "07", cervence: "07", cervenci: "07",
  srpen: "08", srpna: "08", srpnu: "08",
  zari: "09",
  rijen: "10", rijna: "10", rijnu: "10",
  listopad: "11", listopadu: "11", listopadem: "11",
  prosinec: "12", prosince: "12", prosinci: "12",
};

const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

function isoDate(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : undefined;
}

function parseCzechNamedDate(line: string, fallbackYear: number): string | undefined {
  const match = /\b(\d{1,2})\.\s*([a-záčďéěíňóřšťúůýž]+)(?:\s+(20\d{2}))?/i.exec(line);
  if (!match) return undefined;
  const month = CZECH_MONTHS[fold(match[2]!)];
  if (!month) return undefined;
  const year = match[3] ? Number(match[3]) : fallbackYear;
  return isoDate(year, Number(month), Number(match[1]));
}

function parseFeeDeadline(header: string, year: number): string | undefined {
  if (/^\s*od\b|na\s+m[ií]st[eě]/i.test(header)) return undefined;
  const matches = [...header.matchAll(/(\d{1,2})\.\s*(\d{1,2})\./g)];
  const last = matches.at(-1);
  if (!last) return undefined;
  return isoDate(year, Number(last[2]), Number(last[1]));
}

const TOP_HEADINGS = new Set([
  "trasy zavodu",
  "misto a zazemi",
  "startovne",
  "startovni balicek",
  "registrace a vydej cisel",
  "casovy harmonogram",
  "detske zavody",
  "vypsane kategorie",
  "vyhlaseni",
  "dulezite informace",
  "pravidla zavodu",
  "pravidla a dulezite informace",
  "o zavode",
  "zavod v kalendari uci",
  "generalni partner",
  "hlavni medialni partner",
  "partneri",
]);

function isTopHeading(line: string): boolean {
  const f = fold(line);
  if (TOP_HEADINGS.has(f)) return true;
  if (/^(?:startovni balicek|zavod v kalendari uci)\b/.test(f)) return true;
  return false;
}

function sectionLines(lines: string[], heading: RegExp, allowSubheadings?: RegExp): { index: number; lines: string[] } | null {
  const start = lines.findIndex(line => heading.test(fold(line)));
  if (start < 0) return null;
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (isTopHeading(line) && !(allowSubheadings && allowSubheadings.test(fold(line)))) break;
    out.push(line);
  }
  return { index: start, lines: out };
}

function firstLinkUrl(line: string, links: Set<string>): string | undefined {
  for (const match of line.matchAll(/\]\((https?:[^)\s]+)\)/g)) {
    if (links.has(match[1]!)) return match[1]!;
  }
  return undefined;
}

function firstLinkLabel(line: string): string | undefined {
  const match = /\[([^\]]+)\]\(https?:[^)\s]+\)/.exec(line);
  return match ? clean(match[1]!) : undefined;
}

function splitFeeLabel(cell: string): string {
  const known = /^(Trasy?\s+[A-C](?:\s*,\s*[A-C])*(?:\s+a\s+[A-C])?(?:\s*[–-]\s*(?:GIGA|MEGA|FUN|mládež|žáci))?|Classic|Dětské závody(?:\s+D1[–-]D4)?)/i.exec(cell);
  if (known) return clean(known[1]!);
  const glued = /^(.+?[a-záčďéěíňóřšťúůýž0-9ABC])(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž])/.exec(cell);
  return clean(glued ? glued[1]! : cell);
}

function pickParkingNote(lines: string[]): { note: string; quote: string } | null {
  const candidates = lines.filter(line =>
    /parkov/i.test(line) &&
    !/dopln[ií]me/i.test(line) &&
    !/^parkovani(?:\s+v\s+.+)?$/i.test(fold(line)),
  );
  if (!candidates.length) return null;
  const plain = candidates.find(line => !line.includes("](") && line.length >= 3 && line.length <= 400);
  if (plain) return { note: plain, quote: plain };
  for (const line of candidates) {
    const colonPrefix = /^([^[\]]+?):\s*\[/.exec(line);
    if (colonPrefix && /parkov/i.test(colonPrefix[1]!) && clean(colonPrefix[1]!).length >= 10) {
      return { note: clean(colonPrefix[1]!), quote: line };
    }
    for (const match of line.matchAll(/\[([^\]]+)\]\([^)]+\)/g)) {
      const label = clean(match[1]!);
      if (/parkov/i.test(label) && label.length >= 3 && label.length <= 400) {
        return { note: label, quote: line };
      }
    }
    const prefix = clean(line.split("[")[0] ?? "").replace(/[:\s]+$/, "");
    if (/parkov/i.test(prefix) && prefix.length >= 3 && prefix.length <= 400) {
      return { note: prefix, quote: line };
    }
  }
  return null;
}

export function primaCupFacts(
  doc: { url: string; text: string; links?: string[] },
  context: { startDate: string; endDate?: string | null; municipality?: string | null },
): { facts: Record<string, unknown> } {
  const facts: Record<string, unknown> = {};
  const lines = doc.text.split("\n").map(l => clean(l));
  const links = new Set(doc.links ?? []);
  const year = Number(context.startDate.slice(0, 4));
  const endDate = context.endDate ?? context.startDate;

  const titleLine = lines.find(Boolean) ?? "";
  const dateLine =
    lines.find(line => /^\d{1,2}\.(?:[–-]\d{1,2}\.)?\s+[a-záčďéěíňóřšťúůýž]+\s+20\d{2}\b/i.test(line)) ??
    lines.slice(0, 20).find(line => line.length >= 8 && line.includes(String(year)));
  if (!titleLine || !dateLine) return { facts };

  const fact = (value: unknown, quote: string) => ({
    value,
    source_url: doc.url,
    quote,
    identity_quote: titleLine,
    edition_quote: dateLine,
    status: "current",
  });

  // Opening date line often has "10. dubna 2027 Hradec Králové · Stříbrný rybník"
  const openingVenueMatch = /^\d{1,2}\.(?:[–-]\d{1,2}\.)?\s+[a-záčďéěíňóřšťúůýž]+\s+20\d{2}\s+([^·]+?)(?:\s*·\s*(.+))?$/i.exec(dateLine);
  const openingTown = openingVenueMatch?.[1] ? clean(openingVenueMatch[1]) : undefined;
  const openingSubVenue = openingVenueMatch?.[2] ? clean(openingVenueMatch[2]) : undefined;
  const locality =
    context.municipality && fold(doc.text).includes(fold(context.municipality))
      ? context.municipality
      : openingTown && fold(doc.text).includes(fold(openingTown))
        ? openingTown
        : undefined;

  const venueSection = sectionLines(lines, /^misto a zazemi$/);
  const regSection = sectionLines(lines, /^registrace a vydej cisel$/);

  // 1. Venue
  const venueLines = venueSection?.lines ?? [];
  const regLines = regSection?.lines ?? [];
  const startVenueLine = venueLines.find(line =>
    /^(?:start\b|zavod se kona\b|zazemi zavodu je\b)/i.test(fold(line)) &&
    !/dopln[ií]me/i.test(line) &&
    !/parkovi[šs]t/i.test(line),
  );
  const presentationLine = regLines.find(line => /^prezentace z[áa]vodu\s*:/i.test(line));
  const presentationVenue = presentationLine ? firstLinkLabel(presentationLine)?.replace(/\s*[–-]\s*(?:m[íi]sto startu na map[ěe]|mapa)\s*$/i, "").trim() : undefined;

  if (startVenueLine) {
    const linkLabel = firstLinkLabel(startVenueLine)?.replace(/\s*[–-]\s*(?:m[íi]sto startu na map[ěe]|mapa)\s*$/i, "").trim();
    let name: string | undefined;
    let streetAddress: string | undefined;
    if (presentationVenue && fold(startVenueLine).includes(fold(presentationVenue).split(" ").slice(-1)[0] ?? "")) {
      name = presentationVenue;
    } else if (linkLabel && !/zobrazit m[íi]sto/i.test(linkLabel)) {
      name = linkLabel;
    } else if (/louce u hasi[čc][áa]rny/i.test(startVenueLine) && openingSubVenue && /louka u hasi[čc][áa]rny/i.test(openingSubVenue)) {
      name = openingSubVenue;
    } else if (/sport are[áa]lu [čc]esk[ée] petrovice/i.test(startVenueLine)) {
      name = "Sport areál České Petrovice";
    } else if (/ulici [čc]sa/i.test(startVenueLine)) {
      name = "ulice ČSA";
    } else if (openingSubVenue) {
      name = openingSubVenue;
    }
    const streetMatch = /ulice\s+([^·.,]+)/i.exec(startVenueLine);
    if (streetMatch) streetAddress = clean(streetMatch[1]!);

    if (name) {
      const precision = /start/i.test(startVenueLine) ? "start" : "venue";
      facts.venue = fact(
        {
          name,
          precision,
          ...(streetAddress ? { streetAddress } : {}),
          ...(locality ? { locality } : {}),
        },
        startVenueLine,
      );
    }
  } else if (openingSubVenue && !openingSubVenue.includes("·")) {
    facts.venue = fact(
      {
        name: openingSubVenue,
        precision: "venue",
        ...(locality ? { locality } : {}),
      },
      dateLine,
    );
  } else if (locality) {
    facts.venue = fact(
      {
        name: locality,
        precision: "municipality",
        locality,
      },
      dateLine,
    );
  }

  // 2. Parking
  if (venueSection) {
    const parkIdx = venueSection.lines.findIndex(line => /^parkovani(?:\s|$)/i.test(fold(line)));
    const parkingLines = parkIdx >= 0 ? venueSection.lines.slice(parkIdx + 1) : venueSection.lines;
    const parking = pickParkingNote(parkingLines);
    if (parking) {
      facts.parking = fact({ note: parking.note }, parking.quote);
    }
  }

  // 3. Routes
  const routesSection = sectionLines(lines, /^trasy zavodu$/, /^detske zavody$/);
  if (routesSection) {
    const sharedMapLine = routesSection.lines.find(line => /^\[Mapy tras\b/i.test(line));
    const sharedMapUrl = sharedMapLine ? firstLinkUrl(sharedMapLine, links) : undefined;
    const routeItems: { name: string; distanceKm?: number; elevationM?: number; mapUrl?: string; sourceUrl: string; sourceQuote: string }[] = [];

    const routeHeadingRe = /^(Trasa\s+[A-C](?:\s*[–-]\s*(?:GIGA|MEGA|FUN|Elite|Expert|Hobby|žáci))?|Trasa\s+Classic|Dětské závody)$/i;
    const stopInRoutesRe = /^(?:Důležité upozornění|Časové limity|Provozovatel si vyhrazuje|Pořadatel si vyhrazuje|Odkaz zatím|\[Mapy tras\b|Dětské závody:|Nebodovaný závod)/i;

    const rLines = routesSection.lines;
    for (let i = 0; i < rLines.length; i++) {
      const heading = rLines[i]!;
      if (!routeHeadingRe.test(heading)) continue;
      const block: string[] = [];
      for (let j = i + 1; j < rLines.length; j++) {
        const next = rLines[j]!;
        if (routeHeadingRe.test(next) || stopInRoutesRe.test(next)) break;
        if (next) block.push(next);
      }
      const blockText = block.join("\n");
      if (!block.length || /^podrobnosti dopln[ií]me/i.test(blockText)) continue;

      const variantLines = block.filter(line => /^(Muži|Ženy)\s*:/.test(line) && /\d+(?:[.,]\d+)?\s*km\b/i.test(line));
      if (variantLines.length >= 2) {
        const seenLines: string[] = [];
        for (const line of block) {
          seenLines.push(line);
          const vMatch = /^(Muži|Ženy)\s*:/i.exec(line);
          const kmMatch = /(\d+(?:[.,]\d+)?)\s*km\b/i.exec(line);
          if (!vMatch || !kmMatch) continue;
          const elevMatch = /převýšení\s+(\d+(?:[\s\u00a0]\d{3})*)\s*m\b/i.exec(line);
          const noMap = /mapu[^.]*dopln[ií]me/i.test(line);
          const mapUrl = firstLinkUrl(line, links) ?? (!noMap ? sharedMapUrl : undefined);
          routeItems.push({
            name: `${heading} – ${vMatch[1]}`,
            distanceKm: Number(kmMatch[1]!.replace(",", ".")),
            ...(elevMatch ? { elevationM: Number(elevMatch[1]!.replace(/\s/g, "")) } : {}),
            ...(mapUrl ? { mapUrl } : {}),
            sourceUrl: doc.url,
            sourceQuote: [heading, ...seenLines].join("\n"),
          });
        }
        continue;
      }

      const kmMatch = /(\d+(?:[.,]\d+)?)\s*km\b/i.exec(blockText);
      const inlineMap = firstLinkUrl(blockText, links);
      const allowsSharedMap = /^Trasa\s+[A-C]\b/i.test(heading) && !/mapu[^.]*dopln[ií]me/i.test(blockText);
      const mapUrl = inlineMap ?? (allowsSharedMap ? sharedMapUrl : undefined);
      if (!kmMatch && !mapUrl) continue;

      const elevMatch = /převýšení\s+(\d+(?:[\s\u00a0]\d{3})*)\s*m\b/i.exec(blockText);
      routeItems.push({
        name: heading,
        ...(kmMatch ? { distanceKm: Number(kmMatch[1]!.replace(",", ".")) } : {}),
        ...(elevMatch ? { elevationM: Number(elevMatch[1]!.replace(/\s/g, "")) } : {}),
        ...(mapUrl ? { mapUrl } : {}),
        sourceUrl: doc.url,
        sourceQuote: [heading, ...block].join("\n"),
      });
    }
    if (routeItems.length) {
      facts.routes = fact(routeItems, routeItems[0]!.sourceQuote);
    }
  }

  // 4. Fees ("Startovné" table)
  const feesSection = sectionLines(lines, /^startovne$/);
  if (feesSection) {
    const tableLines = feesSection.lines.filter(line => line.includes("|"));
    if (tableLines.length >= 2) {
      const headerLine = tableLines[0]!;
      const headerIdx = lines.indexOf(headerLine);
      const headers = headerLine.split("|").map(c => clean(c));
      const tierColumns = headers.slice(1).map((header, idx) => ({
        colIndex: idx + 1,
        header,
        validUntil: parseFeeDeadline(header, year),
      }));

      const feeItems: { label: string; amount: number; currency: "CZK"; validUntil?: string; sourceUrl: string; sourceQuote: string }[] = [];
      let lastRowIdx = headerIdx;
      for (const rowLine of tableLines.slice(1)) {
        const rowIdx = lines.indexOf(rowLine, lastRowIdx);
        if (rowIdx < 0) continue;
        lastRowIdx = rowIdx;
        const cells = rowLine.split("|").map(c => clean(c));
        const rowLabel = splitFeeLabel(cells[0] ?? "");
        if (!rowLabel) continue;
        const quoteBlock = lines.slice(headerIdx, rowIdx + 1).join("\n");
        const quote = quoteBlock.length <= 1500 ? quoteBlock : rowLine;

        for (const tier of tierColumns) {
          const cell = cells[tier.colIndex];
          if (!cell) continue;
          const priceMatch = /(\d+(?:[\s\u00a0]\d{3})*(?:[.,]\d{1,2})?)\s*(?:Kč|Kc|CZK)(?!\p{L})/iu.exec(cell);
          if (!priceMatch) continue;
          const amount = Number(priceMatch[1]!.replace(/\s/g, "").replace(",", "."));
          feeItems.push({
            label: `${rowLabel} (${tier.header})`,
            amount,
            currency: "CZK",
            ...(tier.validUntil ? { validUntil: tier.validUntil } : {}),
            sourceUrl: doc.url,
            sourceQuote: quote,
          });
        }
      }
      if (feeItems.length) {
        const fullTableQuote = lines.slice(headerIdx, lastRowIdx + 1).join("\n");
        facts.fees = fact(feeItems, fullTableQuote.length <= 1500 ? fullTableQuote : feeItems[0]!.sourceQuote);
      }
    }
  }

  // 5. Schedule ("Časový harmonogram")
  const schedSection = sectionLines(lines, /^casovy harmonogram$/);
  if (schedSection) {
    let currentDay: string | null = null;
    const scheduleItems: { label: string; date: string; time: string; endTime?: string; sourceUrl: string; sourceQuote: string }[] = [];

    for (const line of schedSection.lines) {
      if (/^(?:patek|sobota|nedele|pondeli|utery|streda|ctvrtek)(?:\s|,|$)/i.test(fold(line))) {
        currentDay = parseCzechNamedDate(line, year) ?? currentDay;
        continue;
      }
      if (!currentDay) continue;
      if (currentDay < context.startDate || currentDay > endDate) continue;
      const itemMatch = /^(\d{1,2}):(\d{2})(?:\s*[–-]\s*(\d{1,2}):(\d{2}))?\s*[–-]\s*(.+)$/.exec(line);
      if (!itemMatch) continue;
      const time = `${itemMatch[1]!.padStart(2, "0")}:${itemMatch[2]}`;
      const endTime = itemMatch[3] && itemMatch[4] ? `${itemMatch[3].padStart(2, "0")}:${itemMatch[4]}` : undefined;
      const label = clean(itemMatch[5]!.split(";")[0]!).replace(/\.+$/, "");
      if (!label) continue;
      scheduleItems.push({
        label,
        date: currentDay,
        time,
        ...(endTime ? { endTime } : {}),
        sourceUrl: doc.url,
        sourceQuote: line,
      });
    }
    if (scheduleItems.length) {
      facts.schedule = fact(scheduleItems, scheduleItems[0]!.sourceQuote);
    }
  }

  // 6. Categories ("Vypsané kategorie")
  const catSection = sectionLines(lines, /^vypsane kategorie$/, /^detske zavody$/);
  if (catSection) {
    const categoryItems: { label: string; birthYears?: string; sourceUrl: string; sourceQuote: string }[] = [];
    const seenLabels = new Set<string>();
    const routeSubheading = /^(?:Trasa\s+[A-C](?:\s*[–-].*)?|Classic|Dětské závody)$/i;

    for (const line of catSection.lines) {
      if (!line || routeSubheading.test(line)) continue;
      const label = line.replace(/\.+$/, "").trim();
      if (!label || /\d\s*km\b|tras[ay]\b/i.test(label) || seenLabels.has(label)) continue;
      seenLabels.add(label);
      const yearsMatch =
        /ročníky\s+(\d{4}\s*[–-]\s*\d{4})/i.exec(line) ??
        /\((\d{4}\s*[–-]\s*\d{4}|\d{4}\s+a\s+starší)\)/i.exec(line);
      categoryItems.push({
        label,
        ...(yearsMatch ? { birthYears: clean(yearsMatch[1]!) } : {}),
        sourceUrl: doc.url,
        sourceQuote: line,
      });
    }
    if (categoryItems.length) {
      facts.categories = fact(categoryItems, categoryItems[0]!.sourceQuote);
    }
  }

  // 7. Organizer (only when explicitly stated on the page)
  const orgLine = lines.find(line => /^po[řr]adatel\s*:\s*\S+/i.test(line));
  if (orgLine) {
    const orgName = clean(orgLine.replace(/^po[řr]adatel\s*:\s*/i, ""));
    if (orgName.length >= 3) {
      facts.organizer = fact({ name: orgName }, orgLine);
    }
  }

  return { facts };
}
