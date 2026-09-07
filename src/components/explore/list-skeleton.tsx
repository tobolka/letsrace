/**
 * Placeholder rows for the race list.
 *
 * Shared with the route's `loading.tsx`, which is why it lives here rather than
 * inside the shell: the skeleton the server streams and the one the client
 * shows while refetching have to be the same rows, or the list resizes twice.
 */
export function ListSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          aria-hidden
          role="listitem"
          className="flex h-[60px] animate-pulse flex-col justify-center gap-1.5 border-b border-border/50 px-4 last:border-b-0"
        >
          <div className="h-3.5 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
        </div>
      ))}
    </>
  );
}
