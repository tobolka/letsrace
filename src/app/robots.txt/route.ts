import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/seo";

export function GET() {
  const base = getSiteUrl();
  const body = [
    "# Let's Race robots.txt",
    "User-agent: *",
    // Inside the group, not after it. A blank line ends a record, so sitting
    // below one left this attached to no user-agent at all — the signal was
    // published and applied to nobody. Lighthouse still calls it an unknown
    // directive and docks the SEO audit for it; real crawlers are required to
    // ignore lines they do not recognise, so the audit is the only cost.
    "Content-Signal: ai-train=no, search=yes, ai-input=yes",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /admin/",
    "Disallow: /api/",
    "",
    // Crawlers that read the whole catalogue in every language cost more of the
    // hosting allowance than they bring: one made 45% of a day's requests. A named
    // group replaces the one above for that crawler, so it repeats the rules.
    "User-agent: OAI-SearchBot",
    "Content-Signal: ai-train=no, search=yes, ai-input=yes",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /admin/",
    "Disallow: /api/",
    "Disallow: /de/",
    "Disallow: /pl/",
    "Disallow: /sk/",
    "Disallow: /race-card/",
    "Disallow: /*-2025$",
    "",
    "User-agent: Amazonbot",
    "Disallow: /",
    "",
    "User-agent: Reflectionbot",
    "Disallow: /",
    "",
    // SEO tools and a shopping search read thousands of race pages a day and send no riders.
    "User-agent: SemrushBot",
    "Disallow: /",
    "",
    "User-agent: Amzn-SearchBot",
    "Disallow: /",
    "",
    // A comment, not a directive: "Agentmap:" is not part of the robots.txt
    // grammar and validators read it as a malformed file. The catalogue is
    // already announced properly by the Link headers and under /.well-known.
    `# Agent catalogue: ${base}/.well-known/ai-catalog.json`,
    "",
    `Sitemap: ${base}/sitemap.xml`,
    `Host: ${base}`,
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
