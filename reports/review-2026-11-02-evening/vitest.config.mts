import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ test: { environment: "node", include: ["reports/review-2026-11-02-evening/repro.test.ts"] }, resolve: { alias: { "@": path.resolve(process.cwd(), "src") } } });
