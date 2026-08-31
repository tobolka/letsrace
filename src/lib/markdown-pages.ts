import { seoCopy, SITE_NAME, getSiteUrl } from "@/lib/seo";
import type { Locale } from "@/lib/i18n/messages";

export function homepageMarkdown(locale: Locale): string {
  const base = getSiteUrl();
  const copy = seoCopy[locale] ?? seoCopy.en;
  return `# ${SITE_NAME}

${copy.description}

## Explore

- [Map (English)](${base}/en)
- [Mapa (Česky)](${base}/cs)
- [Mapa (Polski)](${base}/pl)
- [Mapa (Slovensky)](${base}/sk)

## API

- [OpenAPI spec](${base}/openapi.json)
- [API documentation](${base}/docs/api)
- [API catalog](${base}/.well-known/api-catalog)

## Agent discovery

- [AI catalog (ARD)](${base}/.well-known/ai-catalog.json)
- [Agent skills index](${base}/.well-known/agent-skills/index.json)
- [MCP server card](${base}/.well-known/mcp/server-card.json)
- [Auth guide](${base}/auth.md)
`;
}

export function estimateMarkdownTokens(markdown: string): number {
  return Math.ceil(markdown.length / 4);
}
