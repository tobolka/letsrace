import { agentSiteUrl } from "@/lib/agent-discovery";

export function buildOpenApiSpec() {
  const base = agentSiteUrl();
  return {
    openapi: "3.1.0",
    info: {
      title: "Let's Race Public API",
      version: "1.0.0",
      description:
        "Read-only endpoints for cycling race discovery across Central Europe.",
    },
    servers: [{ url: base }],
    paths: {
      "/api/events": {
        get: {
          summary: "List public race events",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "dateFrom", in: "query", schema: { type: "string", format: "date" } },
            { name: "dateTo", in: "query", schema: { type: "string", format: "date" } },
            { name: "west", in: "query", schema: { type: "number" } },
            { name: "south", in: "query", schema: { type: "number" } },
            { name: "east", in: "query", schema: { type: "number" } },
            { name: "north", in: "query", schema: { type: "number" } },
            { name: "disciplines", in: "query", schema: { type: "array", items: { type: "string" } } },
            { name: "country", in: "query", schema: { type: "array", items: { type: "string" } } },
          ],
          responses: {
            "200": {
              description: "Matching events",
              content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
            },
          },
        },
      },
      "/api/series": {
        get: {
          summary: "List race series",
          responses: {
            "200": {
              description: "Series list",
              content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
            },
          },
        },
      },
      "/api/places": {
        get: {
          summary: "Geocode a place name for map navigation",
          parameters: [{ name: "q", in: "query", required: true, schema: { type: "string", minLength: 3 } }],
          responses: {
            "200": { description: "Geocoded place with bounds" },
            "404": { description: "Place not found" },
          },
        },
      },
    },
    security: [],
  };
}
