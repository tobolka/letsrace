import { describe, expect, it } from "vitest";
import { isVirtualRace } from "@/lib/sport-gate";

describe("isVirtualRace", () => {
  it("catches the platform's own racing", () => {
    expect(isVirtualRace("MSZ Tour de Zwift 2025", "AT")).toBe(true);
    expect(isVirtualRace("3.MSZ Tour de Zwift 2026", "AT")).toBe(true);
    expect(isVirtualRace("ZTS Racing | Season VI", "Watopia")).toBe(true);
    expect(isVirtualRace("Zwift Racing League — Round 3", null)).toBe(true);
  });

  it("catches a venue that only exists in software", () => {
    expect(isVirtualRace("Season VII", "Watopia")).toBe(true);
    expect(isVirtualRace("Winter series", "Makuri Islands")).toBe(true);
  });

  it("leaves a real race with a platform as its sponsor alone", () => {
    expect(isVirtualRace("Tour de France Femmes avec Zwift", "A CONFIRMER, France")).toBe(false);
    expect(isVirtualRace("ROUVY Velká cena Vimperka 2026", "Vimperk")).toBe(false);
  });

  it("does not mistake an indoor venue for a virtual one", () => {
    expect(isVirtualRace("10. kolo SP BMX Freestyle: INDOOR JAM (PARK)", "Šurany")).toBe(false);
    expect(isVirtualRace("9. kolo SP BMX Freestyle: INDOOR JAM (STREET)", "Šurany")).toBe(false);
    expect(isVirtualRace("Zimní halový trénink", "Brno")).toBe(false);
  });

  it("leaves ordinary races alone", () => {
    expect(isVirtualRace("Krkonošská 70 MTB", "Vrchlabí")).toBe(false);
    expect(isVirtualRace("Bike Maraton Jelenia Góra", "Jelenia Góra")).toBe(false);
  });
});
