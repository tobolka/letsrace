import { type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BOT_UA } from "@/lib/watcher/http";

const CSC_PUB = "https://portal.czechcyclingfederation.com/Races/Race/Pub";
const RENDER_MS = 55_000;

type CdpResponse = { id?: number; method?: string; result?: unknown; error?: { message?: string } };

/**
 * Blazor Server calendar has no public JSON list. Render the grid and bump
 * page size to 500 so one snapshot covers the season.
 */
export async function renderCscPublicCalendar(url = CSC_PUB): Promise<string> {
  // Never launch Chrome while Next is bundling or on Vercel (NFT traces spawn).
  if (process.env.NEXT_PHASE === "phase-production-build") return "";
  if (process.env.VERCEL) return "";
  const chrome = await resolveChrome();
  if (!chrome) return "";

  const { spawn } = await import(
    /* webpackIgnore: true */
    /* turbopackIgnore: true */
    "node:child_process"
  );
  const port = 10_000 + Math.floor(Math.random() * 20_000);
  const profile = await mkdtemp(join(/* turbopackIgnore: true */ tmpdir(), "csc-chrome-"));
  const proc = spawn(
    /* turbopackIgnore: true */
    chrome.path,
    [
      ...chrome.args,
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${port}`,
      `--user-agent=${BOT_UA}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const deadline = Date.now() + RENDER_MS;
  try {
    await waitForJson(port, deadline);
    const pageUrl = await firstPageWs(port);
    const cdp = await Cdp.connect(pageUrl, deadline);
    try {
      await cdp.send("Page.enable");
      await cdp.send("Runtime.enable");
      await cdp.send("Page.navigate", { url });
      await cdp.wait("Page.loadEventFired", 20_000);
      await waitForRows(cdp, 1, deadline);
      await bumpPageSize(cdp);
      await sleep(2_000);
      const n = await rowCount(cdp);
      if (typeof n === "number" && n >= 80) {
        const html = await cdp.evaluate("document.documentElement.outerHTML");
        return typeof html === "string" ? html : "";
      }
      return await scrapeByPaging(cdp, deadline);
    } finally {
      cdp.close();
    }
  } finally {
    await killChrome(proc);
    await rm(profile, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function resolveChrome(): Promise<{ path: string; args: string[] } | null> {
  const env = process.env.CHROME_PATH?.trim();
  if (env) return { path: env, args: [] };
  const locals = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  const { access } = await import("node:fs/promises");
  for (const p of locals) {
    try {
      await access(p);
      return { path: p, args: [] };
    } catch {
      /* next */
    }
  }
  try {
    const chromium = (await import("@sparticuz/chromium")).default;
    const path = await chromium.executablePath();
    return path ? { path, args: chromium.args ?? [] } : null;
  } catch {
    return null;
  }
}

async function waitForJson(port: number, deadline: number): Promise<void> {
  const url = `http://127.0.0.1:${port}/json/version`;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(800) });
      if (res.ok) return;
    } catch {
      await sleep(150);
    }
  }
  throw new Error("chrome debug port did not open");
}

async function firstPageWs(port: number): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const pages = (await res.json()) as { type?: string; webSocketDebuggerUrl?: string }[];
  const page = pages.find((p) => p.type === "page" && p.webSocketDebuggerUrl) ?? pages[0];
  if (!page?.webSocketDebuggerUrl) throw new Error("no chrome page target");
  return page.webSocketDebuggerUrl;
}

async function bumpPageSize(cdp: Cdp): Promise<void> {
  await cdp.evaluate(`(() => {
    const sel = [...document.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.value === "500"),
    );
    if (!sel) return false;
    sel.value = "500";
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
}

async function rowCount(cdp: Cdp): Promise<number> {
  const n = await cdp.evaluate(
    `document.querySelectorAll("tr.table-row-selectable").length`,
  );
  return typeof n === "number" ? n : 0;
}

async function waitForRows(cdp: Cdp, min: number, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    if ((await rowCount(cdp)) >= min) return;
    await sleep(400);
  }
}

async function scrapeByPaging(cdp: Cdp, deadline: number): Promise<string> {
  const rows = new Map<string, string>();
  let stuck = 0;
  for (let page = 0; page < 30 && Date.now() < deadline; page++) {
    const batch = await cdp.evaluate(`([...document.querySelectorAll("tr.table-row-selectable")]
      .map((tr) => tr.outerHTML))`);
    const before = rows.size;
    if (Array.isArray(batch)) {
      for (const html of batch) {
        if (typeof html !== "string") continue;
        const id = html.match(/\/RaceDetail\/Race\/(\d+)/i)?.[1];
        rows.set(id || html.slice(0, 80), html);
      }
    }
    if (rows.size === before) stuck += 1;
    else stuck = 0;
    if (stuck >= 2) break;
    const moved = await cdp.evaluate(`(() => {
      const next = [...document.querySelectorAll("a, button, li, span")]
        .find((el) => /^\\s*Další\\s*$/.test(el.textContent || ""));
      if (!next) return false;
      if (next instanceof HTMLElement && next.closest("[disabled], .disabled")) return false;
      next.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return true;
    })()`);
    if (!moved) break;
    await sleep(700);
  }
  return `<table class="b-table b-datagrid">${[...rows.values()].join("")}</table>`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function killChrome(proc: ChildProcess): Promise<void> {
  if (proc.exitCode != null) return;
  proc.kill("SIGKILL");
  await sleep(50);
}

class Cdp {
  private id = 0;
  private readonly pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private readonly events = new Map<string, Array<() => void>>();

  private constructor(private readonly ws: WebSocket) {
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data)) as CdpResponse;
      if (msg.id != null) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || "cdp error"));
        else p.resolve(msg.result);
      } else if (msg.method) {
        const waiters = this.events.get(msg.method) ?? [];
        this.events.delete(msg.method);
        for (const w of waiters) w();
      }
    });
  }

  static connect(wsUrl: string, deadline: number): Promise<Cdp> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error("cdp connect timeout"));
      }, Math.max(1_000, deadline - Date.now()));
      ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve(new Cdp(ws));
      });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("cdp socket error"));
      });
    });
  }

  send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  wait(method: string, ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`cdp wait ${method}`)), ms);
      const list = this.events.get(method) ?? [];
      list.push(() => {
        clearTimeout(timer);
        resolve();
      });
      this.events.set(method, list);
    });
  }

  async evaluate(expression: string): Promise<unknown> {
    const result = (await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })) as { result?: { value?: unknown } };
    return result.result?.value;
  }

  close(): void {
    this.ws.close();
  }
}
