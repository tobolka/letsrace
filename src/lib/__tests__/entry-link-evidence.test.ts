import { expect, it } from "vitest";
import { verifyEntryProofs, type EntryProof } from "@/lib/catalog/entry-link-evidence";
const race = { name: "CCT Finale Thaur", start_date: "2026-10-11" };
const proof: EntryProof = { field: "regulations_url", url: "https://example.com/rules.pdf", sourceUrl: "https://example.com/thaur", nameQuote: "CCT Finale Thaur 2026", dateQuote: "11. Oktober 2026", linkQuote: "Ausschreibung Rennrad" };
const doc = { url: proof.sourceUrl, text: "CCT Finale Thaur 2026\n11. Oktober 2026\nAusschreibung Rennrad", html: '<a href="/rules.pdf">Ausschreibung Rennrad</a>', thin: false };
it("accepts a published URL with literal event, date and action evidence", () => {
  expect(verifyEntryProofs(race, [doc], { links: [proof] })).toEqual([proof]);
});
it("rejects fabricated quotations, unknown URLs and another edition", () => {
  for (const change of [{ nameQuote: "Ausschreibung" }, { dateQuote: "11. Oktober ... 2026" }, { url: "https://example.com/invented.pdf" }]) {
    expect(verifyEntryProofs(race, [doc], { links: [{ ...proof, ...change }] })).toEqual([]);
  }
  expect(verifyEntryProofs({ ...race, start_date: "2027-10-11" }, [doc], { links: [proof] })).toEqual([]);
  expect(verifyEntryProofs({ ...race, name: "Innsbruck Finale" }, [doc], { links: [proof] })).toEqual([]);
});
it("rejects a closed form, account link and non-web URL even with quoted action", () => {
  for (const url of ["https://example.com/login", "mailto:entry@example.com", "https://example.com/form"]) {
    const linkQuote = "Anmeldung geschlossen";
    const closed = { ...doc, text: doc.text + "\n" + linkQuote, html: `<a href="${url}">${linkQuote}</a>` };
    expect(verifyEntryProofs(race, [closed], { links: [{ ...proof, field: "registration_url", url, linkQuote }] })).toEqual([]);
  }
});
