import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { radNetCalendarRows, radNetFacts } from "@/lib/catalog/radnet";
import { zipEntries } from "@/lib/catalog/regulation-ages";
import { verifyPracticalExtraction } from "@/lib/catalog/practical-extraction";
import { mergePracticalDetails } from "@/lib/practical-details";
import { federciclismoFacts, rideAndRestFacts } from "@/lib/catalog/federciclismo";

const url = "https://www.rad-net.de/rad-net-portal/a.htm?url=mode%3Dascr_detail";
const text = `Donkey Creek Cyclocross LV Nordrhein-Westfalen Cyclo-Cross
Tag: Sa, 21.11.2026 Ort: 52385 Nideggen-Schmidt Ausrichter: TUS Schmidt 1911 e.V. Veranstalter: TUS Schmidt 1911 e.V. Hinweise: Parkplätze am Sportplatz. Start/Ziel: Eichheckstraße 44 Art: - Nr.-Ausgabe: Eichheckstraße 44 An: Carsten Lennartz Straße: Im Sief 9 Wohnort: 52385 Nideggen Telefon: +49 1704594387 Telefax: - E-Mail: donkey@donkey-creek.de Internet: x R. 1.3: Hobby 15 min olv Start: 10:30 Uhr Strecke: Runde ca. 500m mit ca. 5 HM.; Startberechtigt: R1.3: Hobby Jg. 2015/2016; Ehreng.: Medaillen; R. 3.1: Jugend männlich U17 Nenngeld: 5,00 €/Nachm. 5,00 € 30 min V60/3 olv Start: 10:55 Uhr Strecke: Wiese. Runde ca. 2550m mit ca. 65 HM.; Rennbeginn`;

describe("rad-net", () => {
  const raw = radNetFacts({ url, text }) as { facts: Record<string, { value: unknown }> };
  (raw.facts.schedule!.value as { date: string }[]).forEach(row => { row.date = "2026-11-21"; });
  const { details } = verifyPracticalExtraction(raw, { name: "Donkey Creek Cyclocross", startDate: "2026-11-21", ownUrls: [url], documents: [{ url, text, links: [] }] }) as unknown as { details: Record<string, { value: never }> };

  it("reads who runs the race and whom to write to", () => {
    expect(details.organizer!.value).toMatchObject({ name: "TUS Schmidt 1911 e.V.", contactName: "Carsten Lennartz", phone: "+49 1704594387", email: "donkey@donkey-creek.de" });
  });
  it("reads each class with its start and fee, and says who a plain Hobby is", () => {
    expect(details.fees!.value).toEqual([expect.objectContaining({ label: "Jugend männlich U17", amount: 5, currency: "EUR" })]);
    expect(details.schedule!.value).toEqual(expect.arrayContaining([expect.objectContaining({ time: "10:55" })]));
    expect(details.categories!.value).toEqual(expect.arrayContaining([expect.objectContaining({ birthYears: "2015/2016" })]));
  });
  it("takes the longest lap, not the children's", () => {
    expect(details.routes!.value).toEqual([expect.objectContaining({ distanceKm: 2.55 })]);
  });
  it("finds the rows of a calendar page, also over several days", () => {
    const rows = radNetCalendarRows("Sa, 07.11.2026 [Die Mauer](https://a.de/1) Hürth Cross NRW 04.11.2026 Do, 12.11.2026 bis So, 15.11.2026 [Bahnpokal](https://a.de/2) Berlin Bahn BER");
    expect(rows).toEqual([{ date: "2026-11-07", title: "Die Mauer", url: "https://a.de/1", place: "Hürth" }, { date: "2026-11-12", title: "Bahnpokal", url: "https://a.de/2", place: "Berlin" }]);
  });
});

describe("zip archives", () => {
  it("opens the documents inside", () => {
    const name = Buffer.from("rozpis.pdf"), body = Buffer.from("%PDF-1.4 obsah"), packed = deflateRawSync(body);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(packed.length, 20); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42);
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 10); end.writeUInt32LE(local.length + name.length + packed.length, 16);
    const [entry] = zipEntries(new Uint8Array(Buffer.concat([local, name, packed, central, name, end])));
    expect(entry!.name).toBe("rozpis.pdf");
    expect(Buffer.from(entry!.bytes).toString()).toBe("%PDF-1.4 obsah");
  });
});

describe("lists read from documents", () => {
  const row = (label: string, time: string, sourceUrl: string, checkedAt: string) => ({ label, date: "2026-11-08", time, approximate: false, sourceUrl, sourceQuote: `${time} ${label} row`, checkedAt });
  const fact = (value: unknown[]) => ({ value, sourceUrl: "https://a.test/r", quote: "a quote long enough", checkedAt: "2026-11-06T10:00:00Z", status: "current", editionYear: 2026 });
  it("lets a new reading of a document replace its last one, without repeating rows", () => {
    const old = { schedule: fact([row("Mladší žiaci", "10:00", "https://a.test/r", "2026-11-05T10:00:00Z")]) } as never;
    const next = { schedule: fact([row("Mladší žiaci + Žiačky", "10:00", "https://a.test/r", "2026-11-06T10:00:00Z")]) } as never;
    expect((mergePracticalDetails(old, next).schedule!.value).map(item => item.label)).toEqual(["Mladší žiaci + Žiačky"]);
  });
  it("keeps the fullest timetable and never mixes two documents", () => {
    const series = { schedule: fact([row("Termin", "10:00", "https://a.test/s", "2026-11-05T10:00:00Z")]) } as never;
    const own = { schedule: fact([row("U11", "10:30", "https://a.test/o", "2026-11-06T10:00:00Z"), row("U13", "11:00", "https://a.test/o", "2026-11-06T10:00:00Z")]) } as never;
    expect((mergePracticalDetails(series, own).schedule!.value).map(item => item.label)).toEqual(["U11", "U13"]);
  });
});

describe("Italian federation pages", () => {
  const url = "https://members.federciclismo.it/race/detail/1";
  const text = `Fuoristrada - CICLOCROSS DEL LAGO\n\nData: 15 Novembre 2026\nLuogo: Gavoi (NU)\nCategorie ammesse: Junior M/F - Under23 M/F\n\nOrganizzatore: BIKE TEAM DEMURTAS\nTelefono: 078439050\nEmail: vanni@ciclidemurtas.it\n\nProgramma\n\nCICLOCROSS DEL LAGO\n\nKM: 2,650\n\nDescrizione: CRONOPROGRAMMA:\n• Gara OPEN F - JUNIOR M/F ore 10:15\n\nPartenza: Via Roma 1 - Gavoi (NU) H:09:00\n\nServizi: Ampia area parcheggi - pronto soccorso\n`;
  const raw = federciclismoFacts({ url, text }) as { facts: Record<string, { value: unknown }> };
  (raw.facts.schedule!.value as { date: string }[]).forEach(row => { row.date = "2026-11-15"; });
  const { details, reasons } = verifyPracticalExtraction(raw, { name: "Ciclocross del Lago", startDate: "2026-11-15", ownUrls: [url], documents: [{ url, text, links: [] }], documentSettled: true }) as unknown as { details: Record<string, { value: never }>; reasons: object };
  it("reads the organiser with contact, the classes, the lap and the timetable", () => {
    expect(reasons).toEqual({});
    expect(details.organizer!.value).toMatchObject({ name: "BIKE TEAM DEMURTAS", phone: "078439050", email: "vanni@ciclidemurtas.it" });
    expect(details.categories!.value).toEqual([expect.objectContaining({ label: "Junior M/F" }), expect.objectContaining({ label: "Under23 M/F" })]);
    expect(details.routes!.value).toEqual([expect.objectContaining({ distanceKm: 2.65 })]);
    expect(details.schedule!.value).toEqual([expect.objectContaining({ time: "10:15" })]);
    expect(details.parking!.value).toEqual({ note: "Ampia area parcheggi" });
  });
});

describe("Italian calendar pages", () => {
  it("reads who organises and where riders meet", () => {
    const url = "https://rideandrest.net/manifestazione/x/", text = "domenica 8 Novembre 2026 · FOSSOMBRONE (PU)\nTipo: Enduro\nRitrovo: Corso Garibaldi, ore 07:00\nOrganizza: ASD CLUB MTB SORCI VERDI\n";
    const raw = rideAndRestFacts({ url, text }) as { facts: Record<string, { value: { name?: string; time?: string }[] & { name?: string } }> };
    expect(raw.facts.organizer!.value.name).toBe("ASD CLUB MTB SORCI VERDI");
    expect(raw.facts.venue!.value.name).toBe("Corso Garibaldi");
    expect(raw.facts.schedule!.value[0]!.time).toBe("07:00");
  });
});
