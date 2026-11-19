import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { pageNeedsOcr } from "../../../src/lib/catalog/regulation-ages";
import { pdfPagesText } from "../../../src/lib/catalog/document-ocr";
async function main() {
const directory = resolve("reports/pdf-extraction-2026-11-05/docling-comparison");
const output = resolve("reports/pdf-extraction-2026-11-05/ocr-render-fix");
const manifest = JSON.parse(await readFile(`${directory}/manifest.json`, "utf8")) as { index: number; file: string; pages: number; name: string }[];
for (const row of manifest) {
  const started = performance.now();
  const range = row.index === 25 ? [4, 4] : row.index === 112 ? [7, 7] : [1, row.pages];
  const bytes = new Uint8Array(await readFile(row.file));
  const pdf = await getDocumentProxy(bytes.slice(), { verbosity: 0 });
  const extracted = await extractText(pdf, { mergePages: false });
  const pages = (Array.isArray(extracted.text) ? extracted.text : [extracted.text]).slice(range[0] - 1, range[1]);
  const native = pages.join("\n\n");
  await writeFile(`${output}/baseline-${row.index.toString().padStart(3, "0")}-native.txt`, native);
  const needed = pages.flatMap((page, i) => pageNeedsOcr(page) ? [range[0] + i] : []);
  let ocrError: string | undefined;
  const read = await pdfPagesText(bytes, needed).catch(error => { ocrError = String(error); return new Map<number, string>(); });
  const text = pages.map((page, i) => { const got = read.get(range[0] + i); return got && !pageNeedsOcr(got) ? got : page; }).join("\n\n");
  const stem = `${output}/baseline-${row.index.toString().padStart(3, "0")}`;
  await writeFile(`${stem}.txt`, text);
  const result = { index: row.index, name: row.name, page_range: range, ocr_pages: needed, ocrError, seconds: (performance.now() - started) / 1000, characters: text.length, note: "Current unpdf + Vision; existing OCR cache may apply." };
  await writeFile(`${stem}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}

}
main().catch(error => { console.error(error); process.exitCode = 1; });
