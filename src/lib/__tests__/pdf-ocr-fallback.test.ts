import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ pages: [] as string[], read: new Map<number, string>(), fail: false }));
vi.mock("unpdf", () => ({ getDocumentProxy: vi.fn(async () => ({})), extractText: vi.fn(async () => ({ text: mock.pages })) }));
vi.mock("@/lib/catalog/document-ocr", () => ({ pdfPagesText: vi.fn(async () => { if (mock.fail) throw new Error("timeout"); return mock.read; }) }));
import { pageNeedsOcr, pdfText } from "@/lib/catalog/regulation-ages";
beforeEach(() => { mock.pages = []; mock.read.clear(); mock.fail = false; });
it("recognises missing and broken text without treating ordinary text as a scan", () => {
  expect(pageNeedsOcr("")).toBe(true);
  expect(pageNeedsOcr("\ufffd".repeat(100))).toBe(true);
  expect(pageNeedsOcr("Start závodu 10:00. Pořadatel cyklistický klub. ".repeat(4))).toBe(false);
});
it("replaces longer corrupt text with shorter readable OCR and retains good pages", async () => {
  const good = "Program závodu a startovní časy. ".repeat(5);
  mock.pages = ["\ufffd".repeat(300), good];
  mock.read.set(1, "Program závodu: žáci 10:00, junioři 11:00, elite 12:00.");
  expect(await pdfText(new Uint8Array([1]))).toBe(`${mock.read.get(1)}\n\n${good}`);
});
it("keeps available PDF text when OCR fails", async () => {
  mock.pages = ["Short text"]; mock.fail = true;
  expect(await pdfText(new Uint8Array([1]))).toBe("Short text");
});
