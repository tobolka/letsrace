import { beforeEach, expect, it, vi } from "vitest";
import { rollbackFacts } from "@/lib/catalog/facts";

const rpc = vi.fn();
const evidence = [{ id: "fact", event_id: "race", field: "disciplines" }];
const query = { eq: vi.fn(), gte: vi.fn(), order: vi.fn(), limit: vi.fn() };
const db = { from: vi.fn(() => ({ select: () => query })), rpc };
beforeEach(() => {
  vi.clearAllMocks();
  query.eq.mockReturnValue(query); query.gte.mockReturnValue(query); query.order.mockReturnValue(query);
  query.limit.mockResolvedValue({ data: evidence, error: null });
});

it("surfaces a failed evidence read instead of reporting no changes", async () => {
  query.limit.mockResolvedValue({ data: null, error: { message: "offline" } });
  await expect(rollbackFacts(db as never, { method: "fixture" })).rejects.toThrow("offline");
  expect(rpc).not.toHaveBeenCalled();
});

it("counts only committed or deliberately previewed restoration receipts", async () => {
  rpc.mockResolvedValue({ data: { status: "restored" }, error: null });
  await expect(rollbackFacts(db as never, { method: "fixture", dryRun: true })).resolves.toEqual({ facts: 1, restored: 1, kept: 0 });
  expect(rpc).toHaveBeenCalledWith("pipeline_rollback_fact", { p_fact: "fact", p_dry_run: true });
});

it("keeps protected changes", async () => {
  rpc.mockResolvedValue({ data: { status: "kept", reason: "manual_lock" }, error: null });
  await expect(rollbackFacts(db as never, { method: "fixture" })).resolves.toEqual({ facts: 1, restored: 0, kept: 1 });
});

it("stops on transaction errors and absent confirmations", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "rolled back" } });
  await expect(rollbackFacts(db as never, { method: "fixture" })).rejects.toThrow("rolled back");
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(rollbackFacts(db as never, { method: "fixture" })).rejects.toThrow("not confirmed");
});
