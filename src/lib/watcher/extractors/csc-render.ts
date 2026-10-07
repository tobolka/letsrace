import { type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BOT_UA } from "@/lib/watcher/http";

const CSC_PUB = "https://portal.czechcyclingfederation.com/Races/Race/Pub";
// Eighteen pages of twenty-five at a Blazor round trip each; 55 s was ending runs
// on the clock rather than on the last page.
const RENDER_MS = 90_000;

type CdpResponse = { id?: number; method?: string; result?: unknown; error?: { message?: string } };

/**
 * Blazor Server calendar has no public JSON list. Render the grid and bump
 * page size to 500 so one snapshot covers the season.
 */
/**
 * The federation calendar is never this short. A render that comes back with
 * fewer rows had a page turn or the page-size control fail on a slow Blazor
 * round trip — Radek's first run read one page and wrote seven races.
 */
const MIN_PLAUSIBLE_ROWS = 100;

export async function renderCscPublicCalendar(url = CSC_PUB): Promise<string> {
  // Never launch Chrome while Next is bundling or on Vercel (NFT traces spawn).
  if (process.env.NEXT_PHASE === "phase-production-build") return "";
  if (process.env.VERCEL) return "";
  const chrome = await resolveChrome();
  if (!chrome) return "";
  // One retry: the portal is a shared Blazor server and a slow minute is
  // common. Two short reads in a row are worth reporting; one is not.
  let html = await renderOnce(url, chrome);
  if (countRows(html) < MIN_PLAUSIBLE_ROWS) {
    const again = await renderOnce(url, chrome);
    if (countRows(again) > countRows(html)) html = again;
  }
  return html;
}

function countRows(html: string): number {
  return (html.match(/table-row-selectable/g) ?? []).length;
}

async function renderOnce(
  url: string,
  chrome: NonNullable<Awaited<ReturnType<typeof resolveChrome>>>,
): Promise<string> {
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
    { stdio: "ignore", detached: true },
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
      // Blazor keeps a connection open while it boots, and `load` can arrive
      // late or not at all. The rows are what we are waiting for; the load
      // event is a hint. Twenty seconds on it alone was how a render that
      // finishes at twenty-two seconds counted as "did not render".
      await cdp.wait("Page.loadEventFired", 20_000).catch(() => undefined);
      /*
       * Blazor streams the grid in: the first row lands, then the rest, then
       * the pager and the page-size control. Moving on at the first row read
       * one race off a calendar of 445 and called it a day — a successful
       * run of one event. Wait until the row count has stopped changing, and
       * until the page-size control exists before asking it for everything.
       */
      await waitForSettledRows(cdp, deadline);
      await waitUntil(cdp, `[...document.querySelectorAll("select")].some((s) => [...s.options].some((o) => o.value === "500"))`, Math.min(deadline, Date.now() + 10_000));
      await bumpPageSize(cdp);
      await sleep(1_000);
      await waitForSettledRows(cdp, deadline);
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

export type CscRaceDetail = {
  /** The classes as the portal names them: "Žáci - mladší", "Kadetky". */
  categories: string[];
  /** ISO dates, read as the portal writes them (M/D/YYYY). */
  startDate: string | null;
  entriesCloseDate: string | null;
  web: string | null;
};

/**
 * Read race pages on the federation portal: the classes each race runs.
 *
 * The calendar grid carries none of it. The race page does, in a panel that
 * Blazor fills only when "Detail závodu" is opened, so each page is rendered,
 * the panel clicked open, and its text read. One Chrome for the whole batch;
 * a page that does not open in time is a null, not a failure of the rest.
 */
export async function renderCscRaceDetails(
  urls: string[],
  opts?: { budgetMs?: number; onPage?: (url: string, detail: CscRaceDetail | null) => Promise<void> | void },
): Promise<Map<string, CscRaceDetail | null>> {
  const out = new Map<string, CscRaceDetail | null>();
  if (!urls.length) return out;
  if (process.env.NEXT_PHASE === "phase-production-build") return out;
  if (process.env.VERCEL) return out;
  const chrome = await resolveChrome();
  if (!chrome) return out;
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
      "--window-size=1280,1600",
      "about:blank",
    ],
    { stdio: "ignore", detached: true },
  );
  const deadline = Date.now() + (opts?.budgetMs ?? 10 * 60_000);
  try {
    await waitForJson(port, Math.min(deadline, Date.now() + 20_000));
    const cdp = await Cdp.connect(await firstPageWs(port), deadline);
    try {
      await cdp.send("Page.enable");
      await cdp.send("Runtime.enable");
      for (const url of urls) {
        if (Date.now() > deadline) break;
        const detail = await readOneRace(cdp, url).catch(() => null);
        out.set(url, detail);
        await opts?.onPage?.(url, detail);
      }
    } finally {
      cdp.close();
    }
  } finally {
    await killChrome(proc);
    await rm(profile, { recursive: true, force: true }).catch(() => undefined);
  }
  return out;
}

const DETAIL_TOGGLE = /^\s*(Detail závodu|Race detail)\s*$/i;

async function readOneRace(cdp: Cdp, url: string): Promise<CscRaceDetail | null> {
  await cdp.send("Page.navigate", { url });
  const until = Date.now() + 25_000;
  const ready = await waitUntil(
    cdp,
    `[...document.querySelectorAll("*")].some((el) => el.children.length < 3 && ${DETAIL_TOGGLE}.test(el.textContent || ""))`,
    until,
  );
  if (!ready) return null;
  // A real click at the toggle, repeated: the page is prerendered, so the
  // toggle is on screen a second or two before Blazor's circuit is connected,
  // and a click in that window goes nowhere.
  const OPEN = `/(Start Date|Datum zahájení|Datum od)\\s*:/i.test(document.body.innerText)`;
  let opened = false;
  for (let attempt = 0; attempt < 6 && !opened; attempt++) {
    const box = (await cdp.evaluate(`(() => {
      // The label is text; the chevron button beside it is what opens.
      const el = document.querySelector(".expandable-section button.toggle-button") ||
        [...document.querySelectorAll("*")].filter((e) => ${DETAIL_TOGGLE}.test(e.textContent || "")).pop();
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`)) as { x: number; y: number } | null;
    if (!box) return null;
    for (const type of ["mousePressed", "mouseReleased"]) {
      await cdp.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
    }
    opened = await waitUntil(cdp, OPEN, Date.now() + 2_500);
  }
  if (!opened) return null;
  await sleep(300);
  const text = await cdp.evaluate("document.body.innerText");
  return typeof text === "string" ? parseCscRaceDetailText(text) : null;
}

/** The opened panel, as text: "Category:" then one class a line, until "Start Date:". */
export function parseCscRaceDetailText(text: string): CscRaceDetail {
  const block = text.match(/(?:Category|Kategorie)\s*:\s*([\s\S]*?)\n\s*(?:Start Date|Datum zahájení|Datum od)\s*:/i)?.[1] ?? "";
  const categories = [
    ...new Set(
      block
        .split(/\n/)
        .map((l) => l.replace(/\s+/g, " ").trim())
        .filter((l) => l && !/:$/.test(l)),
    ),
  ];
  const date = (label: string) => {
    const m = text.match(new RegExp(`${label}\\s*:\\s*(\\d{1,2})/(\\d{1,2})/(\\d{4})`, "i"));
    if (!m) return null;
    return `${m[3]}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
  };
  const web = text.match(/\bWeb\s*:\s*(https?:\/\/\S+|www\.\S+)/i)?.[1] ?? null;
  return {
    categories,
    startDate: date("Start Date"),
    entriesCloseDate: date("Entries close date"),
    web,
  };
}

/**
 * Render ordinary web pages that build themselves in the browser — a race
 * site made with a JavaScript framework sends an empty shell to a plain fetch,
 * and its category list exists only after the scripts run. One Chrome for the
 * batch; local only, like the portal reader.
 */
export async function renderPagesHtml(
  urls: string[],
  opts?: { settleMs?: number; budgetMs?: number },
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!urls.length) return out;
  if (process.env.NEXT_PHASE === "phase-production-build") return out;
  if (process.env.VERCEL) return out;
  const chrome = await resolveChrome();
  if (!chrome) return out;
  const { spawn } = await import(
    /* webpackIgnore: true */
    /* turbopackIgnore: true */
    "node:child_process"
  );
  const port = 10_000 + Math.floor(Math.random() * 20_000);
  const profile = await mkdtemp(join(/* turbopackIgnore: true */ tmpdir(), "page-chrome-"));
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
    { stdio: "ignore", detached: true },
  );
  const deadline = Date.now() + (opts?.budgetMs ?? 5 * 60_000);
  const forceStop = setTimeout(() => { void killChrome(proc); }, Math.max(1_000, deadline - Date.now()));
  try {
    await waitForJson(port, Math.min(deadline, Date.now() + 20_000));
    const cdp = await Cdp.connect(await firstPageWs(port), deadline);
    try {
      await cdp.send("Page.enable");
      await cdp.send("Runtime.enable");
      for (const url of urls) {
        if (Date.now() > deadline) break;
        try {
          await cdp.send("Page.navigate", { url });
          await cdp.wait("Page.loadEventFired", 20_000).catch(() => undefined);
          await sleep(opts?.settleMs ?? 2_500);
          const html = await cdp.evaluate("document.documentElement.outerHTML");
          if (typeof html === "string") out.set(url, html);
        } catch {
          /* next page */
        }
      }
    } finally {
      cdp.close();
    }
  } finally {
    clearTimeout(forceStop);
    await killChrome(proc);
    await rm(profile, { recursive: true, force: true }).catch(() => undefined);
  }
  return out;
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
  const res = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5_000) });
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

/** Poll a page-side expression until it is truthy, or the deadline passes. */
async function waitUntil(cdp: Cdp, expr: string, deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    if (await cdp.evaluate(expr)) return true;
    await sleep(300);
  }
  return false;
}

/** At least one row, and the count unchanged across four polls (~1.6 s). */
async function waitForSettledRows(cdp: Cdp, deadline: number): Promise<void> {
  let last = -1;
  let stable = 0;
  while (Date.now() < deadline) {
    const n = await rowCount(cdp);
    if (n >= 1 && n === last) {
      stable += 1;
      if (stable >= 4) return;
    } else {
      stable = 0;
    }
    last = n;
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
    // A page turn is a round trip over Blazor's socket; 700 ms fixed was not
    // always enough, and two short polls in a row read as "stuck". Wait for
    // the first row to actually change, then for the page to settle.
    const firstBefore = await cdp.evaluate(`(document.querySelector("tr.table-row-selectable a[href*='/RaceDetail/Race/']") || {}).getAttribute?.("href") || ""`);
    await waitUntil(
      cdp,
      `((document.querySelector("tr.table-row-selectable a[href*='/RaceDetail/Race/']") || {}).getAttribute?.("href") || "") !== ${JSON.stringify(firstBefore)}`,
      Math.min(deadline, Date.now() + 6_000),
    );
    await waitForSettledRows(cdp, Math.min(deadline, Date.now() + 4_000));
  }
  return `<table class="b-table b-datagrid">${[...rows.values()].join("")}</table>`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function killChrome(proc: ChildProcess): Promise<void> {
  if (proc.exitCode != null || proc.pid == null) return;
  try {
    process.kill(-proc.pid, "SIGKILL");
  } catch {
    try { proc.kill("SIGKILL"); } catch { /* already gone */ }
  }
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
    this.ws.addEventListener("close", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("cdp closed"));
      this.pending.clear();
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

  send(method: string, params?: Record<string, unknown>, timeoutMs = 20_000): Promise<unknown> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`cdp ${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
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
