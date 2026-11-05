import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ files: new Map<string, string>(), output: "[]", fail: false, calls: [] as string[] }));
vi.mock("node:fs", () => ({ existsSync: () => false }));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(), mkdtemp: vi.fn(async () => "/tmp/letsrace-ocr-unit"), rm: vi.fn(),
  readFile: vi.fn(async (path: string) => {
    if (path.endsWith(".swift")) return "mock Swift source";
    if (!mock.files.has(path)) throw new Error("ENOENT");
    return mock.files.get(path);
  }),
  writeFile: vi.fn(async (path: string, value: unknown) => { mock.files.set(path, String(value)); }),
  rename: vi.fn(async (from: string, to: string) => { mock.files.set(to, mock.files.get(from)!); mock.files.delete(from); }),
}));
vi.mock("node:child_process", () => ({ execFile: (command: string, _args: string[], _options: unknown, callback: (error: Error | null, output: string) => void) => {
  mock.calls.push(command);
  callback(mock.fail ? new Error("OCR failed") : null, command.endsWith("swiftc") ? "" : mock.output);
} }));

beforeEach(() => { vi.resetModules(); mock.files.clear(); mock.calls = []; mock.fail = false; mock.output = "[]"; vi.stubGlobal("process", { ...process, platform: "darwin" }); });
afterEach(() => vi.unstubAllGlobals());
describe("local document OCR", () => {
  it("retries an empty PDF recognition and then caches only usable text", async () => {
    const { pdfPagesText } = await import("@/lib/catalog/document-ocr");
    const bytes = new Uint8Array([1, 2, 3]);
    expect((await pdfPagesText(bytes, [1])).get(1)).toBe("");
    mock.output = JSON.stringify([[{ text: "Start 10:00", confidence: 0.9 }]]);
    expect((await pdfPagesText(bytes, [1])).get(1)).toBe("Start 10:00");
    const calls = mock.calls.length;
    expect((await pdfPagesText(bytes, [1])).get(1)).toBe("Start 10:00");
    expect(mock.calls).toHaveLength(calls);
  });
  it("retries compilation after a temporary failure", async () => {
    const { imageText } = await import("@/lib/catalog/document-ocr");
    mock.fail = true;
    await expect(imageText(new Uint8Array([9]))).rejects.toThrow("OCR failed");
    mock.fail = false; mock.output = JSON.stringify([[{ text: "Race", confidence: 1 }]]);
    expect(await imageText(new Uint8Array([9]))).toBe("Race");
    expect(mock.calls.filter(c => c.endsWith("swiftc"))).toHaveLength(2);
  });
  it("skips oversized images and limits PDF work to fifteen pages", async () => {
    const { imageText, pdfPagesText } = await import("@/lib/catalog/document-ocr");
    expect(await imageText(new Uint8Array(13 * 1024 * 1024))).toBe("");
    expect(mock.calls).toEqual([]);
    expect((await pdfPagesText(new Uint8Array([1]), Array.from({ length: 20 }, (_, i) => i + 1))).size).toBe(15);
  });
});
