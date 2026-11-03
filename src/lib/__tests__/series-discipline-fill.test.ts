import { beforeEach, expect, it, vi } from "vitest";
import { fillDisciplinesFromSeries } from "@/lib/catalog/series-disciplines";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ rpc }) }));
beforeEach(() => rpc.mockReset());

it("reports only a confirmed transaction result", async () => {
  rpc.mockResolvedValue({ data: { filled: 2 }, error: null });
  await expect(fillDisciplinesFromSeries()).resolves.toEqual({ filled: 2 });
  expect(rpc).toHaveBeenCalledWith("pipeline_fill_series_disciplines", { p_limit: 3000 });
});

it("surfaces a database failure instead of claiming filled races", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "transaction rolled back" } });
  await expect(fillDisciplinesFromSeries()).rejects.toThrow("transaction rolled back");
});

it.each([null, {}, { filled: -1 }, { filled: 3001 }, { filled: 1.5 }, { filled: "2" }])("rejects an unconfirmed receipt %j", async data => {
  rpc.mockResolvedValue({ data, error: null });
  await expect(fillDisciplinesFromSeries()).rejects.toThrow("not confirmed");
});
