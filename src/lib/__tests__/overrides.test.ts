import { describe, expect, it } from "vitest";
import { lockedFieldsOf } from "@/lib/catalog/overrides";

describe("lockedFieldsOf", () => {
  it("reads the single object PostgREST returns for a unique relation", () => {
    expect(lockedFieldsOf({ locked_fields: ["status", "name"] })).toEqual(["status", "name"]);
  });

  it("reads a list too, and joins what several rows lock", () => {
    expect(lockedFieldsOf([{ locked_fields: ["a"] }, { locked_fields: ["b", "c"] }])).toEqual(["a", "b", "c"]);
  });

  it("finds nothing locked when there is no override, or it locks nothing", () => {
    expect(lockedFieldsOf(null)).toEqual([]);
    expect(lockedFieldsOf(undefined)).toEqual([]);
    expect(lockedFieldsOf({ locked_fields: null })).toEqual([]);
    expect(lockedFieldsOf([])).toEqual([]);
  });
});
