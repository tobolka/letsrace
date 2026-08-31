import Link from "next/link";
import { agentSiteUrl } from "@/lib/agent-discovery";
import { SITE_NAME } from "@/lib/seo";

export default function ApiDocsPage() {
  const base = agentSiteUrl();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 prose prose-stone">
      <h1>{SITE_NAME} API</h1>
      <p>
        Public read endpoints for cycling race discovery. OpenAPI spec at{" "}
        <Link href="/openapi.json">/openapi.json</Link>.
      </p>

      <h2>Endpoints</h2>
      <ul>
        <li>
          <code>GET /api/events</code> — list events (filters: <code>q</code>, dates, bbox, disciplines,
          countries)
        </li>
        <li>
          <code>GET /api/series</code> — list race series
        </li>
        <li>
          <code>GET /api/places?q=</code> — geocode a place (min 3 chars)
        </li>
        <li>
          <code>POST /api/submissions</code> — submit a race URL (OAuth session required)
        </li>
      </ul>

      <h2>Discovery</h2>
      <ul>
        <li>
          <Link href="/.well-known/api-catalog">API catalog</Link> (RFC 9727)
        </li>
        <li>
          <Link href="/.well-known/ai-catalog.json">AI catalog</Link> (ARD)
        </li>
        <li>
          <Link href="/auth.md">auth.md</Link>
        </li>
      </ul>

      <p>
        Base URL: <a href={base}>{base}</a>
      </p>
    </main>
  );
}
