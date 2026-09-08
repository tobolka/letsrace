import { describe, expect, it } from "vitest";
import { readAllRows } from "@/lib/supabase/read-all";

describe("readAllRows", () => {
  const table = Array.from({ length: 2350 }, (_, i) => ({ id: i }));
  const page = (from: number, to: number) =>
    Promise.resolve({ data: table.slice(from, to + 1), error: null });

  it("reads past the thousand-row ceiling", async () => {
    const rows = await readAllRows(page);
    expect(rows).toHaveLength(2350);
    expect(rows[2349]).toEqual({ id: 2349 });
  });

  it("stops on a short page rather than asking for ever", async () => {
    let calls = 0;
    await readAllRows((from, to) => {
      calls += 1;
      return page(from, to);
    });
    expect(calls).toBe(3);
  });

  it("keeps what it has when a page fails", async () => {
    const rows = await readAllRows((from, to) =>
      from === 0
        ? page(from, to)
        : Promise.resolve({ data: null, error: new Error("boom") }),
    );
    expect(rows).toHaveLength(1000);
  });

  it("does not loop for ever on a table that keeps answering", async () => {
    const rows = await readAllRows(
      (from, to) => Promise.resolve({ data: Array.from({ length: to - from + 1 }, () => ({ id: 0 })), error: null }),
      { pageSize: 100, max: 500 },
    );
    expect(rows).toHaveLength(500);
  });
});
