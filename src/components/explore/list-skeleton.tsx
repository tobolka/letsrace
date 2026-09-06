/**
 * Placeholder rows for the race list.
 *
 * Shared with the route's `loading.tsx`, which is why it lives here rather than
 * inside the shell: the skeleton the server streams and the one the client
 * shows while refetching have to be the same rows, or the list resizes twice.
 */
export function ListSkeleton({ rows, compact }: { rows: number; compact?: boolean }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          aria-hidden
          role="listitem"
          className="flex h-[90px] animate-pulse flex-col justify-center gap-2 border-b px-4 last:border-b-0"
        >
          {compact ? null : <div className="h-2.5 w-28 rounded bg-muted" />}
          <div className="h-3.5 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
        </div>
      ))}
    </>
  );
}
