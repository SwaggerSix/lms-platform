import nextPlugin from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";

// Flat-config replacement for the removed `next lint` subcommand
// (Next 16 dropped it). Mirrors the next/core-web-vitals rule set
// plus the plugins its inline eslint-disable directives reference
// (react-hooks, @typescript-eslint).
//
// `no-img-element` is intentionally a warning, not an error: the
// remaining `<img>` sites render dynamic / external / user-content
// images (tenant logos from uploads or data URLs, user-authored
// content blocks, external marketplace thumbnails). `next/image`
// would require those hostnames in `images.remotePatterns`, which
// the `next-config` guardrail deliberately locks to `*.supabase`.
// Loosening that allowlist to satisfy a lint rule would be a net
// regression, so these stay as `<img>`.
export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "next-env.d.ts",
      "public/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@next/next/no-img-element": "warn",
    },
  },
];
