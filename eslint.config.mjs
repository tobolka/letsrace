import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "**/*.cjs",
    "public/maplibre/**",
    // Unmodified, vendored Leaflet 1.9.4 distribution (BSD-2-Clause).
    "public/maps/light-v1/leaflet.js",
    ".claude/worktrees/**",
    "scripts/.tmp/**",
  ]),
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    // Flat config requires the plugin on the same object as the rule overrides.
    plugins: {
      "react-hooks": reactHooks,
    },
    // React Compiler rules flag legitimate map/geo patterns; keep as warnings until refactored.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      // `_html`, `_url`: a parser that keeps its sibling parsers' signature.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;
