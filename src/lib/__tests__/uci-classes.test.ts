import { expect, it } from "vitest";
import downhill from "./fixtures/uci-81090.json";
import junior from "./fixtures/uci-80444.json";
import worldCup from "./fixtures/uci-80749.json";
import { uciClassIn } from "@/lib/uci-class";
import { inferClassification } from "@/lib/taxonomy";
import { parseUciCompetition } from "@/lib/watcher/extractors/uci-competition";
const html = (value: unknown) => `<div data-props='${JSON.stringify(value).replaceAll("'", "&#39;")}'></div>`;
it.each([["81090", downhill, "cs", "continental", "dh"], ["80444", junior, "c1", "international", "xco"], ["80749", worldCup, "cdm", "world_cup", "xcm"]] as const)("preserves the actual UCI competition class and format for %s", (id, data, uciClass, level, discipline) => {
  const [event] = parseUciCompetition(`https://www.uci.org/competition-details/2027/MTB/${id}`, html(data));
  expect(event.uciClass).toBe(uciClass);
  expect(event.discipline).toEqual([discipline]);
  expect(inferClassification({ name:event.name, existingClassLabel:event.uciClass }).level).toBe(level);
});
it("does not turn a mountain bike World Cup into road WorldTour", () => {
  expect(uciClassIn("UCI World Cup")).toBe("cdm");
  expect(uciClassIn("UCI CDM")).toBe("cdm");
  expect(uciClassIn("UCI 2.UWT")).toBe("worldtour");
});
