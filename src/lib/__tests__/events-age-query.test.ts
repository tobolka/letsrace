import { expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ or: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "order", "in", "gte", "lte", "not", "eq", "neq"]) query[method] = () => query;
  query.or = (value: string) => { db.or(value); return query; };
  query.range = async () => ({ data: [], error: null });
  return { from: () => query };
} }));
import { listEvents } from "@/lib/events";
it("lets unknown, guessed and previous-season classes through the database cut for a child's filter", async () => {
  await listEvents({ ageCategories: ["u11"] });
  const clause = db.or.mock.calls[0]![0] as string;
  expect(clause).toContain("age_categories.is.null");
  expect(clause).toContain("age_categories.eq.{}");
  expect(clause).toContain("age_confidence.is.null");
  expect(clause).toContain("age_confidence.eq.default");
  expect(clause).toContain("age_confidence.eq.previous");
});
