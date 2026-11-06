import { describe, expect, it } from "vitest";
import { editionYearSupported, fileStatesEdition, isNotCycling, parseValueJson, isOwnDocument, quoteContainsDate, resolvePracticalEvidence, verifyPracticalExtraction } from "@/lib/catalog/practical-extraction";
import { practicalDetailsForEvent, readPracticalDetails } from "@/lib/practical-details";
const url = "https://club.test/race-2027";
const identity = "JBC 4X Revelations";
const venueQuote = "Where is the race? Areál Dobrá Voda Turnovská 40 466 01, Jablonec nad Nisou 6";
const edition = "JBC 4X Revelations 2027";
const text = `${edition}\n${venueQuote}\nOrganiser: Revelations Club\n9 July 2027 Elite start 09:30\n2027 Entry Elite 500 Kč\n2027 Main route 40 km gravel`;
const context = { name: "4X Pro Tour - JBC 4X Revelations", startDate: "2027-07-09", endDate: "2027-07-10", knownVenue: "Areál Dobrá Voda", documents: [{ url, text, links: [url, "https://club.test/route.gpx"] }], now: "2026-11-03T08:00:00Z" };
const fact = (value: unknown, quote: string, status = "current") => ({ value, quote, source_url: url, identity_quote: identity, edition_quote: edition, status });
it("keeps actual venue/address and organiser facts with independent evidence", () => {
  const result = verifyPracticalExtraction({ facts: { venue: fact({ name: "Areál Dobrá Voda", streetAddress: "Turnovská 40", postalCode: "466 01", locality: "Jablonec nad Nisou 6", precision: "venue" }, venueQuote, "year_neutral"), organizer: fact({ name: "Revelations Club", url }, "Organiser: Revelations Club", "year_neutral") } }, context);
  expect(result.rejected).toEqual([]);
  expect(result.details.venue?.value.streetAddress).toBe("Turnovská 40");
  expect(result.details.organizer?.sourceUrl).toBe(url);
});
it("rejects a real quotation used to support invented values or links", () => {
  const result = verifyPracticalExtraction({ facts: { venue: fact({ name: "Areál Dobrá Voda", streetAddress: "Invented 99", precision: "start" }, venueQuote), routes: fact([{ name: "Main route", distanceKm: 40, gpxUrl: "https://club.test/invented.gpx" }], "2027 Main route 40 km gravel") } }, context);
  // The address is invented, so the venue goes. The 40 km stands in the quote; only the link goes.
  expect(result.details.venue).toBeUndefined(); expect(result.rejected).toEqual(["venue"]);
  expect(result.details.routes?.value[0]).not.toHaveProperty("gpxUrl");
});
it("does not let a new edition heading reconfirm an explicitly old programme", () => {
  const quote = "Programme 2026: 9 July 2027 Elite start 09:30";
  const result = verifyPracticalExtraction({ facts: { schedule: fact([{ label: "Elite start", date: "2027-07-09", time: "09:30" }], quote) } }, { ...context, documents: [{ url, text: `${text}\n${quote}`, links: [] }] });
  expect(result.details).toEqual({});
});
it("rejects old fees/routes and unrelated race identity", () => {
  const result = verifyPracticalExtraction({ facts: { fees: { ...fact([{ label: "Elite", amount: 500, currency: "CZK" }], "2027 Entry Elite 500 Kč", "year_neutral"), edition_quote: "" }, routes: { ...fact([{ name: "Main route", distanceKm: 40 }], "2027 Main route 40 km gravel"), identity_quote: "Race Across Czechia" } } }, context);
  expect(result.details).toEqual({});
});
it("extracts a precise stated time and leaves unstated prices out", () => {
  const result = verifyPracticalExtraction({ facts: { schedule: fact([{ label: "Elite start", date: "2027-07-09", time: "09:30" }], "9 July 2027 Elite start 09:30") } }, context);
  expect(result.details.schedule?.value[0].time).toBe("09:30");
  expect(result.details.fees).toBeUndefined();
});
it("does not lose a valid field when another stored field is malformed", () => {
  const result = verifyPracticalExtraction({ facts: { venue: fact({ name: "Areál Dobrá Voda", precision: "venue" }, venueQuote, "year_neutral") } }, context);
  expect(readPracticalDetails({ ...result.details, fees: { value: "invalid" } })).toEqual(result.details);
});

it("hides stale programme dates after rescheduling and facts from a different edition", () => {
  const result = verifyPracticalExtraction({ facts: { schedule: fact([{ label: "Elite start", date: "2027-07-09", time: "09:30" }], "9 July 2027 Elite start 09:30") } }, context);
  expect(practicalDetailsForEvent(result.details, "2027-07-09").schedule).toBeDefined();
  expect(practicalDetailsForEvent(result.details, "2027-07-16").schedule).toBeUndefined();
  expect(practicalDetailsForEvent(result.details, "2028-07-09")).toEqual({});
});


it("rejects a malformed source URL without losing another correctly sourced field", () => {
  const result = verifyPracticalExtraction({ facts: {
    venue: { ...fact({ name: "Invented", precision: "venue" }, venueQuote), source_url: "not a URL" },
    organizer: fact({ name: "Revelations Club" }, "Organiser: Revelations Club", "year_neutral"),
  } }, context);
  expect(result.rejected).toEqual(["venue"]);
  expect(result.details.organizer?.value.name).toBe("Revelations Club");
});

describe("a race's own regulations", () => {
  const context = { name: "Mistrovství Ústeckého kraje v cyklokrosu", startDate: "2026-11-07", municipality: "Nové Město v Krušných horách" };
  const own = { url: "https://x.cz/propozice.pdf", links: [], text: "ROZPIS\nMistrovství Ústeckého kraje v cyklokrosu pro rok 2026\nTermín Sobota 7.11 2026 v 10:00 hod\nMísto Běžecký stadion Nové Město v Krušných horách\nRegistrace do 6.11.2026" };
  it("recognises a document opening with the race's day and name", () => expect(isOwnDocument(own, context)).toBe(true));
  it("does not take a series' rulebook for it", () => {
    const rulebook = { ...own, text: `Generalausschreibung Mistrovství Ústeckého kraje\n7.11.2026 Kolo 1\n14.11.2026 Kolo 2\n21.11.2026 Kolo 3\n28.11.2026 Kolo 4\n5.12.2026 Kolo 5` };
    expect(isOwnDocument({ ...rulebook, text: rulebook.text.replace(/\n5\.12\.2026 Kolo 5/, "\n1.12.2026 Kolo 5") }, context)).toBe(false);
  });
  it("does not take a document about another day or another race", () => {
    expect(isOwnDocument({ ...own, text: own.text.replace("7.11 2026", "8.11 2026").replace("6.11.2026", "9.10.2026") }, context)).toBe(false);
    expect(isOwnDocument({ ...own, url: "https://x.cz/jine.pdf", text: "Jiný závod v Brně\nTermín 7.11.2026" }, context)).toBe(false);
  });
});

// Regressions from the saved 36-race review: accepting more fields must preserve source checks.
describe("practical source verification regressions", () => {
  const run = (field: string, value: unknown, quote: string, extra = {}) => verifyPracticalExtraction({ facts: { [field]: fact(value, quote) } }, { ...context, startDate: "2027-07-09", endDate: null, documents: [{ url, text: `${text}\n${quote}`, links: [] }], ...extra });
  it("keeps valid rows when another has no time, without inventing midnight", () => {
    const result = run("schedule", [{ label: "Elite start", date: "2027-07-09", time: "09:30" }, { label: "Unknown", date: "2027-07-09" }, { label: "Elite start", date: "2027-07-09", time: "00:00" }], "9 July 2027 Elite start 09:30");
    expect(result.details.schedule?.value.map(row => row.time)).toEqual(["09:30"]);
  });
  it("does not present a range as a precise start", () => {
    expect(run("schedule", [{ label: "Elite start", date: "2027-07-09", time: "09:30" }], "9 July 2027 Elite start 09:30–10:00").details).toEqual({});
  });
  it("normalizes a decimal fee and empty optional URL", () => {
    expect(run("fees", [{ label: "Entry Elite", amount: "17.50", currency: "EUR", url: "" }], "2027 Entry Elite 17,50 EUR").details.fees?.value[0].amount).toBe(17.5);
  });
  it("accepts ceny startovného but refuses prizes and spectator tickets", () => {
    expect(run("fees", [{ label: "Elite", amount: 500, currency: "CZK" }], "2027 Ceny startovného Elite 500 Kč").details.fees).toBeDefined();
    for (const quote of ["2027 Ceny Elite 500 Kč", "2027 Prize Elite 500 Kč", "2027 Ticketprijzen Elite 500 Kč"]) expect(run("fees", [{ label: "Elite", amount: 500, currency: "CZK" }], quote).details).toEqual({});
  });
  it("does not accept an unsupported route surface or a lap as the full distance", () => {
    const route = run("routes", [{ name: "Main route", distanceKm: 40, surface: "sand" }], "2027 Main route 40 km gravel").details.routes?.value[0];
    expect(route?.distanceKm).toBe(40);
    expect(route).not.toHaveProperty("surface");
    expect(run("routes", [{ name: "Runde", distanceKm: 2.55 }], "2027 Runde ca. 2550m").details).toEqual({});
  });
  it("does not borrow row evidence from an unrelated document", () => {
    const other = { url: "https://other.test/race", text: "Another race 9 July 2027 Elite start 09:30", links: [] };
    const result = run("schedule", [{ label: "Elite start", date: "2027-07-09", time: "09:30", sourceUrl: other.url, sourceQuote: other.text }], "9 July 2027 Elite start 09:30", { documents: [...context.documents, other] });
    expect(result.details).toEqual({});
  });
  it("bounds stored evidence from a long literal PDF line", () => {
    const quote = `Organiser: Revelations Club ${"Evidence ".repeat(250)}`;
    const result = run("organizer", { name: "Revelations Club" }, quote);
    expect(result.details.organizer?.value.name).toBe("Revelations Club");
    expect(result.details.organizer?.quote.length).toBeLessThanOrEqual(1500);
  });
  it("finds an exact linked page's date after a long introduction", () => {
    const doc = { url, text: `${"Navigation ".repeat(260)}\nJBC 4X Revelations\n9 July 2027`, links: [] };
    expect(isOwnDocument(doc, { name: identity, startDate: "2027-07-09", ownUrls: [url] })).toBe(true);
    expect(isOwnDocument(doc, { name: identity, startDate: "2027-07-09", ownUrls: ["https://club.test/another-race"] })).toBe(false);
  });
});

 it.each([["Samstag, 13. März 2027", "2027-03-13"], ["Saturday, 7 August 2027", "2027-08-07"], ["08-January-2027", "2027-01-08"]])("reads the stated named date %s", (quote, day) => {
  expect(quoteContainsDate(quote, day)).toBe(true);
  expect(quoteContainsDate(quote, "2027-01-09")).toBe(false);
});
it("accepts both years of a season but no unrelated year", () => {
  expect(editionYearSupported("Reglement 2026/27", 2027)).toBe(true);
  expect(editionYearSupported("Reglement 2026-27", 2026)).toBe(true);
  expect(editionYearSupported("Regulamin_GKKiP_2027", 2027)).toBe(true);
  expect(editionYearSupported("Reglement 2026/28", 2027)).toBe(false);
});
it("does not use an unrelated quote to name a club elsewhere in the document", () => {
  const quote = "Website lokale organisatie: visit the local race website.";
  const result = verifyPracticalExtraction({ facts: { organizer: fact({ name: "Revelations Club" }, quote, "year_neutral") } }, { ...context, documents: [{ url, text: `${text}\n${quote}`, links: [] }] });
  expect(result.details.organizer).toBeUndefined();
});

describe("what an independent read of real regulations caught", () => {
  const silberwald = { url: "https://x.at/a.pdf", links: [], text: "MTB-KIDSRACE SILBERWALD SCHWAZ 2026\nTermin Samstag, 5. September 2026\nAnmeldung www.bikearea.at, 5. Aug., 20 Uhr bis 4. Sept., 20 Uhr\nU7 - U11 € 8,-" };
  it("does not take last year's regulations for this year's because of a yearless deadline", () => {
    expect(isOwnDocument(silberwald, { name: "MTB Silberwald Kidsrace Schwaz", startDate: "2027-09-04", municipality: "Schwaz", ownUrls: [silberwald.url] })).toBe(false);
  });
  it("reads an edition from a file name, but not from a date in it", () => {
    expect(fileStatesEdition("https://x.ch/files/Reglement_Gravel-Ride%20Thurgau27.pdf", 2027)).toBe(true);
    expect(fileStatesEdition("https://x.pl/Regulamin_GKKiP_2027.pdf", 2027)).toBe(true);
    expect(fileStatesEdition("https://x.ch/Reglement_Thurgau26.pdf", 2027)).toBe(false);
    expect(fileStatesEdition("https://x.de/Reglement-2026-08-14.pdf", 2026)).toBe(false);
    expect(fileStatesEdition("https://x.de/2026-11-27.pdf", 2027)).toBe(false);
  });
  const viking = { url: "https://x.de/octf.pdf", links: [], text: "Viking Bike Winterchallenge\nfindet am 08.11.2026 statt.\nStart in Schleswig\nStrecken:\n35 km und 55 km, Gravelstrecke 70 km stehen zum Download bereit.\nGravel-Ride 85km mit 900 Hoehenmeter\nKomoot: CTF 35 km CTF 55 km Gravel 70 km\nDas Orga-Team des Radsport Vereins Schleswig" };
  const context = { name: "Viking Bike Winterchallenge", startDate: "2026-11-08", municipality: "Schleswig", ownUrls: [viking.url], documents: [viking] };
  const fact = (value: unknown, quote: string, status = "current") => ({ value, quote, source_url: viking.url, identity_quote: "", edition_quote: "", status });
  it("accepts a distance glued to km, a route named elsewhere in the document, and a club in another grammatical case", () => {
    const out = verifyPracticalExtraction({ facts: {
      routes: fact([{ name: "CTF 35 km", distanceKm: 35, sourceQuote: "35 km und 55 km, Gravelstrecke 70 km stehen zum Download bereit.", sourceUrl: viking.url }, { name: "Gravel-Ride", distanceKm: 85, sourceQuote: "Gravel-Ride 85km mit 900 Hoehenmeter", sourceUrl: viking.url }], "Strecken:\n35 km und 55 km"),
      organizer: fact({ name: "Radsport Verein Schleswig" }, "Das Orga-Team des Radsport Vereins Schleswig", "year_neutral"),
    } }, context);
    expect(out.reasons).toEqual({});
    expect(out.details.routes?.value.map(route => route.distanceKm)).toEqual([35, 85]);
    expect(out.details.organizer?.value.name).toBe("Radsport Verein Schleswig");
  });
  it("drops a route that is only a name", () => {
    const out = verifyPracticalExtraction({ facts: { routes: fact([{ name: "Viking Bike Winterchallenge", sourceQuote: "Viking Bike Winterchallenge", sourceUrl: viking.url }], "Viking Bike Winterchallenge\nfindet am 08.11.2026 statt.") } }, context);
    expect(out.details.routes).toBeUndefined();
  });
  it("takes a fact's source from its rows when the fact itself gives none", () => {
    const resolved = resolvePracticalEvidence({ facts: [{ field: "routes", value_json: JSON.stringify([{ name: "Gravel-Ride", distanceKm: 85, sourceLines: { first: 6, last: 6 }, sourceUrl: viking.url }]), source_url: "", status: "current" }] }, [viking]) as { facts: { routes: { source_url: string; quote: string } } };
    expect(resolved.facts.routes.source_url).toBe(viking.url);
    expect(resolved.facts.routes.quote).toContain("85km");
  });
  it("repairs what the model writes broken and keeps only whole rows", () => {
    expect(parseValueJson('{"name":"MGLKS „Olimpijczyk" Szczekociny"}')).toEqual({ name: 'MGLKS „Olimpijczyk" Szczekociny' });
    expect(parseValueJson('[{"name":"A","distanceKm":5},{"name":"B","sourceLines":{"first":23,')).toEqual([{ name: "A", distanceKm: 5 }]);
    expect(parseValueJson("not json")).toBeNull();
  });
  it("keeps a fee whose deadline stands elsewhere, without the deadline, and refuses a protest fee", () => {
    const doc = { url: "https://x.pl/a.pdf", links: [], text: "Wyścig 08.11.2026 Szczekociny\nMłodzik, Młodziczka  25 zł\nEinspruchsgebühr von 100 €" };
    const out = verifyPracticalExtraction({ facts: { fees: { value: [{ label: "Młodzik", amount: 25, currency: "PLN", validUntil: "2026-11-05", sourceQuote: "Młodzik, Młodziczka  25 zł", sourceUrl: doc.url }, { label: "Einspruchsgebühr", amount: 100, currency: "EUR", sourceQuote: "Einspruchsgebühr von 100 €", sourceUrl: doc.url }], quote: "Młodzik, Młodziczka  25 zł", source_url: doc.url, identity_quote: "", edition_quote: "", status: "current" } } }, { name: "Wyścig", startDate: "2026-11-08", municipality: "Szczekociny", ownUrls: [doc.url], documents: [doc] });
    expect(out.details.fees?.value).toHaveLength(1);
    expect(out.details.fees?.value[0]).not.toHaveProperty("validUntil");
  });
  const list = { url: "https://x.ch/anmeldung", links: [], text: "Säntis-Classic 13. Juni 2027 Weinfelden\nClassic-Tour ohne Trikot\nStartzeit: 07:30\nFrauen / Männer\nab\nCHF 90.00\nRadathlon\nFrauen / Männer\nCHF 190.00" };
  const race = { name: "Säntis-Classic", startDate: "2027-06-13", municipality: "Weinfelden", ownUrls: [list.url], documents: [list] };
  const fees = (rows: unknown[]) => verifyPracticalExtraction({ facts: { fees: { value: rows, quote: "Classic-Tour ohne Trikot\nStartzeit: 07:30", source_url: list.url, identity_quote: "", edition_quote: "", status: "current" } } }, race);
  it("finds a price list's label above a bare price, but not across another price", () => {
    expect(fees([{ label: "Classic-Tour ohne Trikot", amount: 90, currency: "CHF", sourceQuote: "CHF 90.00", sourceUrl: list.url }]).details.fees?.value).toHaveLength(1);
    expect(fees([{ label: "Classic-Tour ohne Trikot", amount: 190, currency: "CHF", sourceQuote: "CHF 190.00", sourceUrl: list.url }]).details.fees).toBeUndefined();
  });
  it("does not take an add-on for the entry fee", () => {
    const addOn = { ...list, text: `${list.text}\nFlex-Option gegen Aufpreis von EUR 10,00` };
    const out = verifyPracticalExtraction({ facts: { fees: { value: [{ label: "Flex-Option", amount: 10, currency: "EUR", sourceQuote: "Flex-Option gegen Aufpreis von EUR 10,00", sourceUrl: list.url }], quote: "Flex-Option gegen Aufpreis von EUR 10,00", source_url: list.url, identity_quote: "", edition_quote: "", status: "current" } } }, { ...race, documents: [addOn] });
    expect(out.details.fees).toBeUndefined();
  });
  it("reads a full-hour start, a table without currency and a race named after a lap", () => {
    const doc = { url: "https://x.pl/r.pdf", links: [], text: "Müggelheimer Runde Sonntag 08.11.2026 Berlin\nStartzeit: 10 Uhr\nStreckenlänge: 48 km\nOpłaty startowe wg taryfikatora 50 zł dla amatorów\nKategoria  Opłata A\nElita  60,00" };
    const context2 = { name: "Müggelheimer Runde", startDate: "2026-11-08", municipality: "Berlin", ownUrls: [doc.url], documents: [doc] };
    const fact2 = (value: unknown, quote: string) => ({ value, quote, source_url: doc.url, identity_quote: "", edition_quote: "", status: "current" });
    const out = verifyPracticalExtraction({ facts: {
      schedule: fact2([{ label: "Startzeit", date: "2026-11-08", time: "10:00", sourceQuote: "Startzeit: 10 Uhr", sourceUrl: doc.url }], "Startzeit: 10 Uhr"),
      routes: fact2([{ name: "Müggelheimer Runde", distanceKm: 48, sourceQuote: "Streckenlänge: 48 km", sourceUrl: doc.url }], "Streckenlänge: 48 km"),
      fees: fact2([{ label: "Elita", amount: 60, currency: "PLN", sourceQuote: "Elita  60,00", sourceUrl: doc.url }], "Kategoria  Opłata A\nElita  60,00"),
    } }, context2);
    expect(out.reasons).toEqual({});
    expect(out.details.fees?.value[0].amount).toBe(60);
  });
  it("tells running and skating items from cycling ones", () => {
    for (const label of ["3 Rosen Cross-Lauf: Erwachsene", "42,195 km Marathonlauf", "Burger Nachtlauf 5 km", "Trasa Nordic Walking", "Trasa biegu", "Skate-Marathon 42 km"]) expect(isNotCycling(label), label).toBe(true);
    for (const label of ["Radtour 150 km", "2. Lauf Elite", "pojedynczy bieg/marsz/rowerowanie", "U23 m / Elite m", "Zeitlicher Ablauf", "CTF 35 km", "Gravel 70 km"]) expect(isNotCycling(label), label).toBe(false);
  });
  it("does not take a venue from another round's row or a document about another town", () => {
    const cup = { url: "https://x.ch/afeno.pdf", links: [], text: "AFENO Cup 2026\nRENNDATEN\n4132 Muttenz BL 14.11.2026\n4313 Möhlin AG 07.11.2026\nGruppe A: 12.00 Uhr" };
    const context3 = { name: "Afeno Cup #5", startDate: "2026-11-07", municipality: "Möhlin", ownUrls: [cup.url], documents: [cup] };
    const venue = (name: string, quote: string) => ({ value: { name, precision: "municipality", locality: name }, quote, source_url: cup.url, identity_quote: "AFENO Cup 2026", edition_quote: "AFENO Cup 2026", status: "current" });
    expect(verifyPracticalExtraction({ facts: { venue: venue("Muttenz", "RENNDATEN\n4132 Muttenz BL 14.11.2026") } }, context3).details.venue).toBeUndefined();
    expect(verifyPracticalExtraction({ facts: { venue: venue("Möhlin", "4313 Möhlin AG 07.11.2026") } }, context3).details.venue?.value.name).toBe("Möhlin");
    const other = { url: "https://x.pl/e.html", links: [], text: "Rajd Niepodległości 2026 Chojnice\nMiejsce zbiórki: Plac przed Centrum Kultury" };
    expect(verifyPracticalExtraction({ facts: { venue: { value: { name: "Plac przed Centrum Kultury", precision: "venue" }, quote: "Miejsce zbiórki: Plac przed Centrum Kultury", source_url: other.url, identity_quote: "Rajd Niepodległości 2026", edition_quote: "Rajd Niepodległości 2026", status: "year_neutral" } } }, { name: "Rajd Niepodległości", startDate: "2026-11-07", municipality: "Świecie", documents: [other] }).details.venue).toBeUndefined();
  });
});

describe("organiser contact, parking and categories", () => {
  const url = "https://spsvd.cz/propozice.pdf";
  const text = "HŮRECKÝ KRPÁL 7.11.2026 Hůrka u Jistebnice\nPořadatel: SPSVD Jistebnice\nŘeditel závodu: Zdeněk Tomeček Tel.: 731 402 943 E-mail: info@spsvd.cz\nParkování na vyznačeném místě v prostoru startu a cíle.\nZK Kadetky 2011 – 2012\nMJ Junioři 2009 – 2010";
  const context = { name: "Hůrecký krpál", startDate: "2026-11-07", municipality: "Hůrka u Jistebnice", ownUrls: [url], documents: [{ url, text, links: [] }], now: "2026-11-06T10:00:00.000Z" };
  const fact = (value: unknown, quote: string) => ({ value, source_url: url, quote, identity_quote: "HŮRECKÝ KRPÁL 7.11.2026", edition_quote: "HŮRECKÝ KRPÁL 7.11.2026", status: "current" });
  it("keeps a contact the document gives and drops one it does not", () => {
    const { details } = verifyPracticalExtraction({ facts: { organizer: fact({ name: "SPSVD Jistebnice", contactName: "Zdeněk Tomeček", phone: "731 402 943", email: "jiny@spsvd.cz" }, "Pořadatel: SPSVD Jistebnice") } }, context);
    expect(details.organizer?.value).toEqual({ name: "SPSVD Jistebnice", contactName: "Zdeněk Tomeček", phone: "731 402 943" });
  });
  it("keeps parking only as the document words it", () => {
    expect(verifyPracticalExtraction({ facts: { parking: fact({ note: "Parkování na vyznačeném místě v prostoru startu a cíle." }, "Parkování na vyznačeném místě v prostoru startu a cíle.") } }, context).details.parking?.value.note).toContain("vyznačeném");
    expect(verifyPracticalExtraction({ facts: { parking: fact({ note: "Parkoviště zdarma u kostela" }, "Parkování na vyznačeném místě v prostoru startu a cíle.") } }, context).details.parking).toBeUndefined();
  });
  it("keeps categories with the birth years the document states", () => {
    const { details } = verifyPracticalExtraction({ facts: { categories: fact([{ label: "Kadetky", birthYears: "2011 – 2012", sourceQuote: "ZK Kadetky 2011 – 2012" }, { label: "Junioři", birthYears: "1999 – 2000", sourceQuote: "MJ Junioři 2009 – 2010" }], "ZK Kadetky 2011 – 2012") } }, context);
    expect(details.categories?.value.map(row => row.label)).toEqual(["Kadetky"]);
  });
  it("takes the coordinates off a venue's name", () => {
    const { details } = verifyPracticalExtraction({ facts: { venue: fact({ name: "Hůrka u Jistebnice 49.4728000N, 14.5471622E", precision: "venue" }, "HŮRECKÝ KRPÁL 7.11.2026 Hůrka u Jistebnice") } }, { ...context, documents: [{ url, text: `${text}\nHůrka u Jistebnice 49.4728000N, 14.5471622E`, links: [] }] });
    expect(details.venue?.value.name).toBe("Hůrka u Jistebnice");
  });
  it("does not take a series' head for the round's organiser, nor the series for its own organiser", () => {
    const calendar = "ODERSKÝ POHÁR 2026\n12. 09. 2026 Rohov\n19. 09. 2026 Žádlovice\n26. 09. 2026 Ostrava\n27. 09. 2026 Frýdek\n10. 10. 2026 Třebová\n7. 11. 2026 Hůrka u Jistebnice HŮRECKÝ KRPÁL\nHlavní pořadatel: ACS DRAK Vrbno";
    const series = { ...context, ownUrls: [], documents: [{ url, text: calendar, links: [] }] };
    expect(verifyPracticalExtraction({ facts: { organizer: { ...fact({ name: "ACS DRAK Vrbno" }, "Hlavní pořadatel: ACS DRAK Vrbno"), identity_quote: "7. 11. 2026 Hůrka u Jistebnice HŮRECKÝ KRPÁL", edition_quote: "ODERSKÝ POHÁR 2026" } } }, series).reasons.organizer).toBe("series_not_round");
    const tbc = { ...context, name: "TBC — Hůrka", documents: [{ url, text: `${text}\nPořadatel: TBC Serie`, links: [] }] };
    expect(verifyPracticalExtraction({ facts: { organizer: fact({ name: "TBC Serie" }, "Pořadatel: TBC Serie") } }, tbc).details.organizer).toBeUndefined();
  });
  it("accepts an organiser's address written without https", () => {
    const { details } = verifyPracticalExtraction({ facts: { organizer: fact({ name: "SPSVD Jistebnice", url: "www.spsvd.cz" }, "Pořadatel: SPSVD Jistebnice") } }, { ...context, documents: [{ url, text, links: ["https://www.spsvd.cz"] }] });
    expect(details.organizer?.value.name).toBe("SPSVD Jistebnice");
  });
  it("refuses spectators' tickets as an entry fee", () => {
    const quote = "On-site box office 450 CZK";
    const { details } = verifyPracticalExtraction({ facts: { fees: fact([{ label: "On-site box office", amount: 450, currency: "CZK", sourceQuote: quote }], quote) } }, { ...context, documents: [{ url, text: `${text}\n${quote}`, links: [] }] });
    expect(details.fees).toBeUndefined();
  });
  it("reads \"ročník 2011-2012\" as a birth year, not as another edition", () => {
    const quote = "ZK – Kadetky, ročník 2011-2012";
    const { details } = verifyPracticalExtraction({ facts: { categories: fact([{ label: "Kadetky", birthYears: "2011-2012", sourceQuote: quote }], quote) } }, { ...context, documents: [{ url, text: `${text}\n${quote}`, links: [] }] });
    expect(details.categories?.value[0]?.label).toBe("Kadetky");
  });
  it("does not take a traffic notice for the venue", () => {
    const quote = "Divieto di transito e di sosta in Piazza Silvio Arrivabene";
    expect(verifyPracticalExtraction({ facts: { venue: fact({ name: "Piazza Silvio Arrivabene", precision: "venue" }, quote) } }, { ...context, documents: [{ url, text: `${text}\n${quote}`, links: [] }] }).reasons.venue).toBe("traffic_notice");
  });
  it("does not take a route's distance for a category", () => {
    const quote = "CTF 35 km CTF 55 km Gravel 70 km";
    const { details } = verifyPracticalExtraction({ facts: { categories: fact([{ label: "CTF 35 km", sourceQuote: quote }, { label: "Gravel 70 km", sourceQuote: quote }], quote) } }, { ...context, documents: [{ url, text: `${text}\n${quote}`, links: [] }] });
    expect(details.categories).toBeUndefined();
  });
});
