import nextPlugin from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";

// Flat-config replacement for the removed `next lint` subcommand
// (Next 16 dropped it). Mirrors the next/core-web-vitals rule set
// plus the plugins its inline eslint-disable directives reference
// (react-hooks, @typescript-eslint).
//
// `no-img-element` is an ERROR globally so a new stray `<img>` (e.g.
// a Supabase-hosted asset that should use next/image) gets caught.
// The existing keepers are listed in IMG_KEEPERS below: they render
// dynamic / external / user-content images (tenant logos from
// uploads or data URLs, user-authored content blocks, external
// marketplace thumbnails) or local SVGs. `next/image` would require
// those hostnames in `images.remotePatterns` — which the
// `next-config` guardrail deliberately locks to `*.supabase` — or
// `dangerouslyAllowSVG`. Loosening either to satisfy a lint rule
// would be a net regression, so these stay as `<img>`.
const IMG_KEEPERS = [
  "src/app/(dashboard)/admin/settings/settings-client.tsx",
  "src/app/(dashboard)/shop/\\[productId\\]/product-detail-client.tsx",
  "src/app/(dashboard)/shop/cart/cart-client.tsx",
  "src/app/(dashboard)/shop/orders/orders-client.tsx",
  "src/components/content-editor/block-renderer.tsx",
  "src/components/layout/sidebar.tsx",
  "src/components/marketplace/external-course-card.tsx",
  "src/components/marketplace/unified-catalog.tsx",
  "src/components/microlearning/nugget-card.tsx",
  "src/components/shop/product-card.tsx",
  "src/components/tenants/branding-editor.tsx",
  "src/components/tenants/tenant-switcher.tsx",
];

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
      // react-hooks recommended (rules-of-hooks: error,
      // exhaustive-deps: warn) — the codebase has inline
      // `exhaustive-deps` disables that depend on it being enabled.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // `no-require-imports` flags the lazy `require()` sites (each
      // carrying a scoped disable). `no-explicit-any` and
      // `no-bitwise` are left off: the codebase has 600+ `any` uses
      // and legitimate bitwise (hashing) code, so enabling them
      // would bury the meaningful warnings — their few stale
      // disables are removed instead.
      "@typescript-eslint/no-require-imports": "warn",
      "@next/next/no-img-element": "error",
    },
  },
  {
    files: IMG_KEEPERS,
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
];
