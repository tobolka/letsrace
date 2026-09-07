import { describe, expect, it } from "vitest";
import { listViewState } from "@/lib/list-view-state";

describe("listViewState", () => {
  it("shows placeholders until the list has settled", () => {
    expect(listViewState({ settled: false, count: 0 })).toBe("skeleton");
    expect(listViewState({ settled: false, count: 40 })).toBe("skeleton");
  });

  it("never calls it empty while the first request is still in flight", () => {
    // The regression: the page stopped sending races, so the count was zero
    // during loading and "No races match these filters" appeared under a
    // spinner that was still turning.
    expect(listViewState({ settled: false, count: 0 })).not.toBe("empty");
  });

  it("says empty only once an answer has arrived", () => {
    expect(listViewState({ settled: true, count: 0 })).toBe("empty");
  });

  it("shows rows when there are some", () => {
    expect(listViewState({ settled: true, count: 1 })).toBe("rows");
  });
});
