import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as cheerio from "cheerio";

type OcrLine = { text: string; confidence: number };
let building: Promise<string> | undefined;
const OCR_READER_VERSION = "vision-rows-v4";
const execute = (command: string, args: string[], timeout: number) => new Promise<string>((ok, fail) => {
  execFile(command, args, { timeout, maxBuffer: 32 * 1024 * 1024 }, (error, stdout) => error ? fail(error) : ok(stdout));
});
async function binary(): Promise<string> {
  building ??= (async () => {
    const source = resolve("scripts/ocr-document.swift");
    const hash = createHash("sha1").update(await readFile(source)).digest("hex").slice(0, 12);
    const path = resolve(`tmp/ocr-cache/vision-${hash}`);
    await mkdir(resolve("tmp/ocr-cache"), { recursive: true });
    if (!existsSync(path)) {
      const temporary = `${path}.${randomUUID()}`;
      try { await execute("/usr/bin/swiftc", [source, "-o", temporary], 60_000); await rename(temporary, path); }
      finally { await rm(temporary, { force: true }); }
    }
    return path;
  })().catch(error => { building = undefined; throw error; });
  return building;
}

/** Organizer posters embedded in a public page, read locally, cached by bytes. */
export async function embeddedDocumentText(html: string): Promise<string> {
  if (process.platform !== "darwin") return "";
  const $ = cheerio.load(html);
  const images = $("img[src]").toArray().map((node) => $(node).attr("src") ?? "")
    .filter((src) => /^data:image\/(png|jpe?g);base64,/i.test(src)).slice(0, 12);
  if (!images.length) return "";
  const folder = await mkdtemp(join(tmpdir(), "letsrace-ocr-"));
  try {
    const texts: string[] = [];
    for (const [index, image] of images.entries()) {
      const bytes = Buffer.from(image.slice(image.indexOf(",") + 1), "base64");
      if (bytes.length > 4 * 1024 * 1024) continue;
      const hash = createHash("sha1").update(bytes).digest("hex");
      const cache = resolve(`tmp/ocr-cache/${OCR_READER_VERSION}-${hash}.json`);
      let lines: OcrLine[] = [];
      try {
        const cached: unknown = JSON.parse(await readFile(cache, "utf8"));
        if (Array.isArray(cached)) lines = cached;
      } catch { /* Unreadable cache is retried. */ }
      if (!lines.length) {
        const path = join(folder, `${index}.png`);
        await writeFile(path, bytes);
        const got = JSON.parse(await execute(await binary(), [path], 90_000)) as OcrLine[][];
        lines = got[0] ?? [];
        const temporary = `${cache}.${randomUUID()}`;
        if (lines.length) {
          await writeFile(temporary, JSON.stringify(lines));
          await rename(temporary, cache);
        }
      }
      if (lines.length) texts.push(`Organizer image ${index + 1} (OCR):\n${lines.map((line) => line.text).join("\n")}`);
    }
    return texts.join("\n\n");
  } finally { await rm(folder, { recursive: true, force: true }); }
}

const MAX_OCR_PAGES = 15;
const PAGE_TIMEOUT = 45_000;
// The first use after a while spends about 40 s loading the recognition models.
const COLD_START = 90_000;

/** Pages of a PDF that hold no real text, read as pictures. Numbers count from 1. Cached by bytes. */
export async function pdfPagesText(bytes: Uint8Array, pages: number[]): Promise<Map<number, string>> {
  const read = new Map<number, string>();
  const wanted = pages.slice(0, MAX_OCR_PAGES);
  if (process.platform !== "darwin" || !wanted.length) return read;
  const hash = createHash("sha1").update(bytes).digest("hex");
  await mkdir(resolve("tmp/ocr-cache"), { recursive: true });
  const cachePath = (page: number) => resolve(`tmp/ocr-cache/${OCR_READER_VERSION}-${hash}-p${page}.json`);
  const missing: number[] = [];
  for (const page of wanted) {
    let cached: unknown;
    try { cached = JSON.parse(await readFile(cachePath(page), "utf8")); } catch { /* Unreadable cache is retried. */ }
    if (typeof cached === "string" && cached.trim()) read.set(page, cached);
    else missing.push(page);
  }
  if (!missing.length) return read;
  const folder = await mkdtemp(join(tmpdir(), "letsrace-ocr-"));
  try {
    const path = join(folder, "document.pdf");
    await writeFile(path, bytes);
    const got = JSON.parse(await execute(await binary(), [`${path}#${missing.join(",")}`], COLD_START + PAGE_TIMEOUT * missing.length)) as OcrLine[][];
    for (const [index, page] of missing.entries()) {
      const text = (got[index] ?? []).map((line) => line.text).join("\n");
      read.set(page, text);
      if (!text.trim()) continue; // A failed recognition must remain retryable.
      const temporary = `${cachePath(page)}.${randomUUID()}`;
      await writeFile(temporary, JSON.stringify(text));
      await rename(temporary, cachePath(page));
    }
    return read;
  } finally { await rm(folder, { recursive: true, force: true }); }
}

/** A poster or scan sent as a picture. */
export async function imageText(bytes: Uint8Array): Promise<string> {
  if (process.platform !== "darwin" || bytes.length > 12 * 1024 * 1024) return "";
  const hash = createHash("sha1").update(bytes).digest("hex");
  await mkdir(resolve("tmp/ocr-cache"), { recursive: true });
  const cache = resolve(`tmp/ocr-cache/${OCR_READER_VERSION}-${hash}-image.json`);
  try {
    const cached: unknown = JSON.parse(await readFile(cache, "utf8"));
    if (typeof cached === "string" && cached.trim()) return cached;
  } catch { /* Unreadable cache is retried. */ }
  const folder = await mkdtemp(join(tmpdir(), "letsrace-ocr-"));
  try {
    const path = join(folder, "image");
    await writeFile(path, bytes);
    const got = JSON.parse(await execute(await binary(), [path], COLD_START + PAGE_TIMEOUT)) as OcrLine[][];
    const text = (got[0] ?? []).map((line) => line.text).join("\n");
    if (!text.trim()) return "";
    const temporary = `${cache}.${randomUUID()}`;
    await writeFile(temporary, JSON.stringify(text));
    await rename(temporary, cache);
    return text;
  } finally { await rm(folder, { recursive: true, force: true }); }
}
