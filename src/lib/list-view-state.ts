/**
 * Which of the three things the race list is showing.
 *
 * These are genuinely three states, and writing them as two nested conditions
 * is how "nothing found" came to be shown while the first request was still in
 * flight: the count is zero before the answer arrives as well as after, so the
 * empty state has to ask whether the list has settled before it asks how many.
 */
export type ListViewState = "skeleton" | "empty" | "rows";

export function listViewState(opts: { settled: boolean; count: number }): ListViewState {
  if (!opts.settled) return "skeleton";
  return opts.count === 0 ? "empty" : "rows";
}
