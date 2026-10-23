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
    // Unmodified, vendored Leaflet 1.9.4 distribution (BSD-2-Clause).
    "public/maps/light-v1/leaflet.js",
    "public/prototypes/**",
    ".claude/worktrees/**",
    "scripts/.tmp/**",
    // Untracked scratch space for one-off investigations.
    "tmp/**",
  ]),
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    // Flat config requires the plugin on the same object as the rule overrides.
    plugins: {
      "react-hooks": reactHooks,
    },
    // React Compiler rules: state follows props and stores, not effects, and refs
    // are written when a render commits, not while it computes.
    rules: {
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/refs": "error",
      // `_html`, `_url`: a parser that keeps its sibling parsers' signature.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;
