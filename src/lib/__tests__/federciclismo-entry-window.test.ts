import { describe, expect, it } from "vitest";
import { federciclismoEntryWindow } from "@/lib/catalog/federciclismo";

const page = (line: string) => `Giovanile - GARA\nData: 13 Dicembre 2026\nOrganizzatore: G.S. TEST\n${line}\nProgramma\n`;

describe("Italian federation entry window", () => {
  it("reads a window that closes before the race day, with the line as its quote", () => {
    const out = federciclismoEntryWindow(page("Iscrizioni: 28/10/2026 - 11/12/2026"), "2026-12-13");
    expect(out).toEqual({ opensAt: "2026-10-28", closesAt: "2026-12-11", quote: "Iscrizioni: 28/10/2026 - 11/12/2026" });
  });

  it("ignores a window that closes on the race day or later, which says only 'enter on the day'", () => {
    expect(federciclismoEntryWindow(page("Iscrizioni: 13/12/2026 - 13/12/2026"), "2026-12-13")).toBeNull();
    expect(federciclismoEntryWindow(page("Iscrizioni: 01/12/2026 - 14/12/2026"), "2026-12-13")).toBeNull();
  });

  it("ignores impossible, reversed or missing windows", () => {
    expect(federciclismoEntryWindow(page("Iscrizioni: 31/02/2026 - 11/12/2026"), "2026-12-13")).toBeNull();
    expect(federciclismoEntryWindow(page("Iscrizioni: 11/12/2026 - 28/10/2026"), "2026-12-13")).toBeNull();
    expect(federciclismoEntryWindow(page("Telefono: 3382787176"), "2026-12-13")).toBeNull();
  });
});
