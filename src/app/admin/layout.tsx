import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-stone-900"
            >
              Startline Admin
            </Link>
            <nav className="hidden gap-3 text-sm text-stone-600 sm:flex">
              <Link href="/admin" className="hover:text-stone-900">
                Overview
              </Link>
              <Link href="/admin/sources" className="hover:text-stone-900">
                Sources
              </Link>
              <Link href="/admin/events" className="hover:text-stone-900">
                Events
              </Link>
              <Link href="/admin/events/new" className="hover:text-stone-900">
                Add event
              </Link>
              <Link href="/admin/discovery" className="hover:text-stone-900">
                Discovery
              </Link>
              <Link href="/admin/inbox" className="hover:text-stone-900">
                Inbox
              </Link>
            </nav>
          </div>
          <Link href="/en" className="text-sm text-stone-500 hover:text-stone-800">
            ← Map
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
