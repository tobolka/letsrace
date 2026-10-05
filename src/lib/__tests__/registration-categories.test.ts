import { afterEach, describe, expect, it, vi } from "vitest";
import { htmlRegistrationCategories, partialCategoryPatch, raceResultFormCategories, raceResultParticipantCategories, raceResultRegistrationEvidence, registrationEditionMatches } from "@/lib/catalog/registration-categories";

afterEach(() => vi.unstubAllGlobals());
describe("public registration category evidence", () => {
  it("reads category options without club/name fields, including unoccupied classes", () => {
    expect(htmlRegistrationCategories(`<label for="c">Kategorie</label><select id="c"><option>U9</option><option>U11</option><option>Masters</option></select><select name="Club"><option>Junior Cycling Club</option></select><input name="FirstName" value="Jane">`)).toEqual(["U9", "U11", "Masters"]);
    expect(raceResultFormCategories({ Steps: [{ Elements: [{ Children: [
      { Field: { Name: "AgeGroup", Values: [{ Label: "U7" }, { Label: "U9", SoldOut: true }] } },
      { Field: { Name: "Club", Values: [{ Label: "Elite Cycling" }] } },
      { Field: { Name: "FirstName", Value: "Jane" } },
      { Label: "Altersklasse", Field: { Name: "CustomField1", Values: [{ Label: "Masters" }] } },
    ] }] }] })).toEqual(["U7", "U9", "Masters"]);
    expect(htmlRegistrationCategories('<label><input type="radio" name="category_id" value="1">U11</label><label><input type="radio" name="Gender" value="f">Women</label>')).toEqual(["U11"]);
  });
  it("matches the edition date in Czech and ISO formats, not merely a birth year", () => {
    expect(registrationEditionMatches("<h1>10. 10. 2026</h1>", "2026-10-10")).toBe(true);
    expect(registrationEditionMatches("<time>2026-10-10T08:00</time>", "2026-10-10")).toBe(true);
    expect(registrationEditionMatches("<h1>10. 10. 2025</h1><option>ročník 2026</option>", "2026-10-10")).toBe(false);
  });
  it("projects only the age class from participant filters and columns", () => {
    const labels = raceResultParticipantCategories({
      list: { Orders: [{ Expression: "Contest", Grouping: 0 }, { Expression: "Contest.Name", Grouping: 2 }, { Expression: "AgeGroup.Name", Grouping: 3 }, { Expression: "LastName", Grouping: 0 }] },
      groupFilters: [{ Values: ["50 km"] }, { Values: ["U11", "Junioren"] }],
      DataFields: ["ID", "FirstName", "AgeGroup.Name", "LastName"],
      data: { "#1_race": [["1", "Jane", "Masters", "Doe"], ["2", "John", "U11", "Smith"]] },
    });
    expect(labels).toEqual(["U11", "Junioren", "Masters"]);
    expect(JSON.stringify(labels)).not.toMatch(/Jane|John|Smith|Doe|50 km/);
  });
  it("never derives classes from unrelated participant fields", () => {
    expect(raceResultParticipantCategories({ DataFields: ["Club", "FirstName"], data: [["Junior Cycling Club", "U11"]] })).toEqual([]);
  });
  it("adds positive child evidence while leaving unlisted ages uncertain", () => {
    const patch = partialCategoryPatch(["amateur"], ["U11"], 2026);
    expect(patch).toEqual({ age_categories: ["u11", "kids", "amateur"], age_confidence: "default" });
    expect(patch).not.toHaveProperty("audience");
    expect(partialCategoryPatch(["u11", "kids"], ["U11"], 2026)).toBeNull();
    expect(partialCategoryPatch(null, ["30 km"], 2026)).toBeNull();
  });
  it("rejects forms belonging to a different edition before fetching people or forms", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ EventDate: "2025-10-10", Registrations: [{ Name: "Entry", Key: "public-form-key" }] }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await raceResultRegistrationEvidence("123456", "2026-10-10")).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("loads only the blank initial public form, and retains only category evidence", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => ({ ok: true, json: async () =>
      url.includes("registration/config") ? { EventDate: "2026-10-10", Registrations: [{ Name: "Entry", Key: "public-form-key" }, { Name: "Private", Key: "private-form", IfLoggedIn: 1 }] } :
      url.includes("registrations/request") ? { State: "session", RegID: "session", Steps: [{ Elements: [{ Field: { Name: "AgeGroup", Values: [{ Label: "U9" }] } }] }] } :
      { Tab: { Enabled: true }, TabConfig: { Lists: [] } },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await raceResultRegistrationEvidence("123456", "2026-10-10");
    expect(result).toEqual([{ labels: ["U9"], ages: ["u9", "kids"], sourceUrl: "https://my.raceresult.com/123456/registration?regname=Entry" }]);
    const requests = fetchMock.mock.calls.filter(([url]) => url.includes("registrations/request"));
    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0]![1].body)).toEqual({ URL: "https://my.raceresult.com/123456/registration" });
    expect(JSON.stringify(result)).not.toMatch(/session|public-form-key/);
  });
});
