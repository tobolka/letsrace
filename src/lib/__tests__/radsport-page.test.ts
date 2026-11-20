import { describe, expect, it, vi } from "vitest";
import { radsportEventId, radsportEventText, readRadsportEvent } from "@/lib/catalog/radsport-page";

describe("radsport-events page text", () => {
  it("knows an event page address and nothing else", () => {
    expect(radsportEventId("https://radsport-events.de/events/27469")).toBe("27469");
    expect(radsportEventId("https://www.radsport-events.de/events/942/")).toBe("942");
    expect(radsportEventId("https://radsport-events.de/")).toBeNull();
    expect(radsportEventId("https://example.com/events/27469")).toBeNull();
  });

  it("builds the text from the API fields a reader sees", () => {
    const text = radsportEventText({ title: "Motz-Chautagne Tour", city: "Motz", eventDate: "2027-04-18", description: "Drei Strecken über 51, 81 und 111 km.", eventType: null });
    expect(text).toContain("Motz-Chautagne Tour");
    expect(text).toContain("Drei Strecken über 51, 81 und 111 km.");
    expect(text).not.toContain("null");
  });

  it("reads the API, and gives null when it does not answer", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ title: "Dunkelwald Climb", description: "Ein MTB-Zeitfahren über 5 km." })));
    expect(await readRadsportEvent("https://radsport-events.de/events/942", ok as unknown as typeof fetch)).toContain("MTB-Zeitfahren");
    expect(ok).toHaveBeenCalledWith("https://api.radsport-events.de/api/v1/events/942", expect.anything());
    const down = vi.fn(async () => new Response("no", { status: 503 }));
    expect(await readRadsportEvent("https://radsport-events.de/events/942", down as unknown as typeof fetch)).toBeNull();
    expect(await readRadsportEvent("https://example.com/x", ok as unknown as typeof fetch)).toBeNull();
  });
});
