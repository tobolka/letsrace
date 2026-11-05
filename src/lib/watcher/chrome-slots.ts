import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

/**
 * Limit Chrome across every worker process of a parallel pass on the Mac, since each
 * window takes hundreds of megabytes. A slot left by a crashed process is reclaimed.
 * Without LOCAL_CHROME_SLOTS_DIR this does nothing.
 */
export async function withChromeSlot<T>(work: () => Promise<T>, opts?: { directory?: string; slots?: number; waitMs?: number }): Promise<T> {
  const directory = opts?.directory ?? process.env.LOCAL_CHROME_SLOTS_DIR;
  if (!directory) return work();
  const slots = opts?.slots ?? Number(process.env.LOCAL_CHROME_SLOTS ?? 3);
  await mkdir(directory, { recursive: true });
  for (;;) {
    for (let slot = 0; slot < slots; slot++) {
      const path = join(directory, `slot-${slot}`);
      try {
        await mkdir(path);
      } catch {
        const owner = Number(await readFile(join(path, "pid"), "utf8").catch(() => ""));
        if (owner && !alive(owner)) await rm(path, { recursive: true, force: true });
        continue;
      }
      await writeFile(join(path, "pid"), String(process.pid));
      try { return await work(); } finally { await rm(path, { recursive: true, force: true }); }
    }
    await new Promise(resolve => setTimeout(resolve, opts?.waitMs ?? 500));
  }
}
