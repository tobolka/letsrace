import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as cheerio from "cheerio";

type OcrLine = { text: string; confidence: number };
let building: Promise<string> | undefined;
const execute = (command: string, args: string[], timeout: number) => new Promise<string>((ok, fail) => {
  execFile(command, args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => error ? fail(error) : ok(stdout));
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
  })();
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
      const cache = resolve(`tmp/ocr-cache/${hash}.json`);
      let lines: OcrLine[];
      if (existsSync(cache)) lines = JSON.parse(await readFile(cache, "utf8"));
      else {
        const path = join(folder, `${index}.png`);
        await writeFile(path, bytes);
        const got = JSON.parse(await execute(await binary(), [path], 90_000)) as OcrLine[][];
        lines = got[0] ?? [];
        const temporary = `${cache}.${randomUUID()}`;
        await writeFile(temporary, JSON.stringify(lines));
        await rename(temporary, cache);
      }
      if (lines.length) texts.push(`Organizer image ${index + 1} (OCR):\n${lines.map((line) => line.text).join("\n")}`);
    }
    return texts.join("\n\n");
  } finally { await rm(folder, { recursive: true, force: true }); }
}
