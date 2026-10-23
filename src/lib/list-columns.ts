/**
 * Which columns the race list shows, in what order.
 *
 * The list is a table somebody works in, so they pick its columns — and the
 * pick is theirs on this device, kept in local storage, with the default one
 * click away. A stored layout is read defensively: a column that no longer
 * exists is dropped and one added since is appended hidden, so an old layout
 * never breaks the page or loses the name column.
 */
export const LIST_COLUMNS = [
  "date",
  "name",
  "place",
  "country",
  "discipline",
  "level",
  "categories",
  "series",
  "distance",
] as const;

export type ListColumn = (typeof LIST_COLUMNS)[number];

export type ColumnLayout = { order: ListColumn[]; hidden: ListColumn[] };

export const DEFAULT_LAYOUT: ColumnLayout = {
  order: [...LIST_COLUMNS],
  hidden: ["country", "categories", "series"],
};

/** Always on: a row without its name or date is not a race. */
export const LOCKED: ListColumn[] = ["date", "name"];

const KEY = "letsrace.list.columns.v1";

export function normalizeLayout(raw: unknown): ColumnLayout {
  if (!raw || typeof raw !== "object") return DEFAULT_LAYOUT;
  const r = raw as Partial<ColumnLayout>;
  const known = (v: unknown): v is ListColumn => LIST_COLUMNS.includes(v as ListColumn);
  const order = Array.isArray(r.order) ? r.order.filter(known) : [];
  const seen = new Set(order);
  const added = LIST_COLUMNS.filter((c) => !seen.has(c));
  const hidden = Array.isArray(r.hidden) ? r.hidden.filter(known).filter((c) => !LOCKED.includes(c)) : [];
  return {
    order: [...new Set([...order, ...added])],
    hidden: [...new Set([...hidden, ...added.filter((c) => DEFAULT_LAYOUT.hidden.includes(c))])],
  };
}

export function parseLayout(raw: string | null): ColumnLayout {
  try {
    return raw ? normalizeLayout(JSON.parse(raw)) : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

// Where storage is blocked, a choice still holds for as long as the page is open.
let memory: string | null = null;
const listeners = new Set<() => void>();

/** The stored layout as text, so a store snapshot compares by value. */
export function readLayoutRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

export function subscribeLayout(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function readLayout(): ColumnLayout {
  return parseLayout(readLayoutRaw());
}

export function writeLayout(layout: ColumnLayout | null): void {
  memory = layout ? JSON.stringify(layout) : null;
  try {
    if (memory) window.localStorage.setItem(KEY, memory);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  listeners.forEach((notify) => notify());
}

/** Move `col` one place towards `dir`, skipping nothing. */
export function moveColumn(order: ListColumn[], col: ListColumn, to: number): ListColumn[] {
  const from = order.indexOf(col);
  if (from < 0 || to < 0 || to >= order.length || from === to) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, col);
  return next;
}
