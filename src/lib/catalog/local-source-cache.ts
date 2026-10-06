import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ReadDoc } from "@/lib/catalog/regulation-ages";

export async function writeJsonAtomic(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2));
  await rename(temp, path);
}

export async function readJson<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, "utf8")) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return null; throw error; }
}

/** Persistent shared document cache; failed reads remain retryable on resume. */
export function localSourceReader(opts: { directory: string; read: (url: string) => Promise<ReadDoc | null>; maxAgeMs: number; deadline: number; stopped: () => boolean }) {
  const pending = new Map<string, Promise<ReadDoc | null>>();
  const failures = new Set<string>();
  let downloaded = 0, cached = 0;
  const read = (raw: string): Promise<ReadDoc | null> => {
    const url = raw.replace(/#.*$/, "");
    if (!pending.has(url)) pending.set(url, (async () => {
      if (opts.stopped() || Date.now() >= opts.deadline) return null;
      const path = resolve(opts.directory, `${createHash("sha256").update(url).digest("hex")}.json`);
      const previous = await readJson<{ readAt: number; document: ReadDoc }>(path);
      if (previous?.document && Date.now() - previous.readAt < opts.maxAgeMs) { cached++; return previous.document; }
      try {
        const document = await opts.read(url);
        if (!document) { failures.add(url); return null; }
        downloaded++;
        await writeJsonAtomic(path, { readAt: Date.now(), document });
        return document;
      } catch { failures.add(url); return null; }
    })());
    return pending.get(url)!;
  };
  return { read, failures, stats: () => ({ downloaded, cached, failed: failures.size }) };
}
