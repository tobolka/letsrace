import { describe, expect, it } from "vitest";
import { looksLikeRide } from "@/lib/pipeline2/rides";

describe("names that read like a ride without a result", () => {
  it("knows brevets, RTF, CTF and rajd", () => {
    for (const name of ["Brevet Rheinland 200", "BRM 400 Wasserkinder", "Lehrter RTF", "Stahlrad Laatzen Advents-CTF", "Nocny Rajd Rowerowy - Wągrowiec", "Bydgoski Rowerowy Rajd Niepodległości", "Randonnée des Vosges", "Spanilá jízda"]) expect(looksLikeRide(name), name).toBe(true);
  });
  it("leaves timed races alone, also the ones open to everyone", () => {
    for (const name of ["Bikemaraton Drásal", "Schleizer Dreieck Jedermann", "UCI Gran Fondo Burgenland", "Mladá Boleslav Tour", "Antoniana Gravel", "Kolo pro život — Ralsko MTB Tour", "Cyklokros Slavkov u Brna", "Giro delle Dolomiti"]) expect(looksLikeRide(name), name).toBe(false);
  });
});
