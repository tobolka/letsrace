import { beforeEach, describe, expect, it, vi } from "vitest";
import { persist } from "@/lib/account/save";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

describe("account persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps a confirmed change without an error notification", async () => {
    const rollback = vi.fn();
    expect(await persist(Promise.resolve({ error: null }), { locale: "cs", onFailure: rollback })).toBe(true);
    expect(rollback).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each(["database", "network"])("rolls back a %s failure and allows retry", async (kind) => {
    const rollback = vi.fn();
    const work = kind === "database"
      ? Promise.resolve({ error: { message: "private database detail" } })
      : Promise.reject(new TypeError("Failed to fetch"));
    expect(await persist(work, { locale: "cs", onFailure: rollback })).toBe(false);
    expect(rollback).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith("Neuloženo — zkontroluj připojení a zkus to znovu");
  });
});
