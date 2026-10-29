import { assessCandidate } from "./assessment";
import type { SearchProvider } from "./plan";
import type { DiscoveryState } from "./store";

/** Credit each provider through follow-up links; a shared discovery counts for both. */
export function discoveryContributions(state: DiscoveryState) {
  const providersOf = (id: string, visited = new Set<string>()): Set<SearchProvider> => {
    if (visited.has(id)) return new Set();
    visited.add(id);
    const task = state.tasks[id];
    if (!task) return new Set();
    if (task.kind === "search") return new Set([task.spec.provider]);
    return new Set(task.origins.flatMap(origin => [...providersOf(origin, visited)]));
  };
  return (["ai", "brave", "openai"] as const).map(provider => {
    const searches = Object.values(state.tasks).filter(t => t.kind === "search" && t.spec.provider === provider);
    const sources = Object.values(state.tasks).filter(t => t.kind === "read" && t.lane === "blind" && providersOf(t.id).has(provider));
    const candidates = Object.values(state.candidates).filter(c => c.origins.some(id => providersOf(id).has(provider)));
    return { provider, status: searches.length === 0 ? "not_requested" : searches.every(t => t.status === "done") ? "searched" : "incomplete",
      searchErrors: searches.flatMap(t => t.error ? [t.error] : []), initialSources: sources.filter(t => t.kind === "read" && t.depth === 0).length,
      sourcesIncludingFollowups: sources.length, sourceBackedReviewCandidates: candidates.filter(c => assessCandidate(c.event).state === "needs_review" && c.event.evidence?.quote).length,
      publicationVerifiedRaces: null, note: "Extraction/identity review is unfinished. Source counts are not new races." };
  });
}
