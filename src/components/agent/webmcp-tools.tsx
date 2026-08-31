"use client";

import { useEffect } from "react";

type ModelContextTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

type ModelContext = {
  registerTool: (tool: ModelContextTool) => () => void;
};

function getModelContext(): ModelContext | undefined {
  return (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
}

export function WebMcpTools() {
  useEffect(() => {
    const mc = getModelContext();
    if (!mc?.registerTool) return;

    const unregister = [
      mc.registerTool({
        name: "search_events",
        description: "Search cycling races by text query, dates, or map bounding box.",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Free-text search" },
            dateFrom: { type: "string", format: "date" },
            dateTo: { type: "string", format: "date" },
            west: { type: "number" },
            south: { type: "number" },
            east: { type: "number" },
            north: { type: "number" },
          },
        },
        execute: async (input) => {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(input)) {
            if (value != null && value !== "") params.set(key, String(value));
          }
          const res = await fetch(`/api/events?${params.toString()}`);
          if (!res.ok) throw new Error(`search_events failed: ${res.status}`);
          return res.json();
        },
      }),
      mc.registerTool({
        name: "geocode_place",
        description: "Geocode a town or region to get map bounds for race discovery.",
        inputSchema: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string", minLength: 3, description: "Place name, e.g. Prague" },
          },
        },
        execute: async (input) => {
          const q = String(input.q ?? "");
          const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
          if (!res.ok) throw new Error(`geocode_place failed: ${res.status}`);
          return res.json();
        },
      }),
      mc.registerTool({
        name: "list_series",
        description: "List race series with optional date and discipline filters.",
        inputSchema: {
          type: "object",
          properties: {
            dateFrom: { type: "string", format: "date" },
            dateTo: { type: "string", format: "date" },
          },
        },
        execute: async (input) => {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(input)) {
            if (value != null && value !== "") params.set(key, String(value));
          }
          const res = await fetch(`/api/series?${params.toString()}`);
          if (!res.ok) throw new Error(`list_series failed: ${res.status}`);
          return res.json();
        },
      }),
    ];

    return () => {
      for (const off of unregister) off();
    };
  }, []);

  return null;
}
