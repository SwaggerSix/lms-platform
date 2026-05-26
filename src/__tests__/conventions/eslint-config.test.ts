import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";

/**
 * Next 16 removed the `next lint` subcommand, which silently broke
 * `npm run lint` (and therefore the pre-push gate) until a flat
 * `eslint.config.mjs` was added and the script repointed at the
 * ESLint CLI. This guardrail keeps that wiring from regressing:
 *
 *  - the `lint` script must invoke `eslint`, not the removed
 *    `next lint`;
 *  - `eslint.config.mjs` must register the parser + plugins the
 *    codebase's inline disable directives depend on.
 *
 * Snapshot-style so a future Next bump or config edit that drops a
 * plugin shows up as a deliberate diff.
 */

const ROOT = process.cwd();

describe("eslint config wiring", () => {
  it("lint script uses the eslint CLI, not the removed `next lint`", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const lint = pkg.scripts?.lint ?? "";
    expect(lint).toContain("eslint");
    expect(lint).not.toContain("next lint");
  });

  it("check script still chains lint + tsc + conventions", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const check = pkg.scripts?.check ?? "";
    expect(check).toContain("lint");
    expect(check).toContain("tsc --noEmit");
    expect(check).toContain("test:conventions");
  });

  it("CI runs `npm run lint` (the restored gate can't be silently dropped)", () => {
    const wf = readFileSync(join(ROOT, ".github/workflows/conventions.yml"), "utf8");
    expect(wf).toContain("npm run lint");
  });

  it("eslint.config.mjs registers the parser + plugins the tree relies on", () => {
    const source = readFileSync(join(ROOT, "eslint.config.mjs"), "utf8");
    for (const dep of [
      "@next/eslint-plugin-next",
      "@typescript-eslint/parser",
      "@typescript-eslint/eslint-plugin",
      "eslint-plugin-react-hooks",
    ]) {
      expect(source, `imports ${dep}`).toContain(dep);
    }
  });

  it("applies the next core-web-vitals + recommended rule sets", () => {
    const source = readFileSync(join(ROOT, "eslint.config.mjs"), "utf8");
    expect(source).toContain("core-web-vitals");
    expect(source).toContain("recommended");
  });

  it("no-img-element is an error globally", () => {
    const source = readFileSync(join(ROOT, "eslint.config.mjs"), "utf8");
    expect(source).toMatch(/"@next\/next\/no-img-element":\s*"error"/);
  });

  // Snapshot the `<img>` keeper list so adding a file to dodge the
  // now-`error` rule lands as a deliberate diff (mirrors the other
  // config snapshots). Each keeper renders dynamic / external /
  // user-content images or local SVGs that can't use next/image
  // without loosening the locked image allowlist.
  it("IMG_KEEPERS list is snapshotted", () => {
    const source = readFileSync(join(ROOT, "eslint.config.mjs"), "utf8");
    const block = source.match(/const IMG_KEEPERS = \[([\s\S]*?)\];/);
    expect(block, "IMG_KEEPERS array present").not.toBeNull();
    const files = Array.from(block![1].matchAll(/"([^"]+)"/g))
      .map((m) => m[1].replace(/\\/g, ""))
      .sort();
    expect(files).toMatchInlineSnapshot(`
      [
        "src/app/(dashboard)/admin/settings/settings-client.tsx",
        "src/app/(dashboard)/shop/[productId]/product-detail-client.tsx",
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
      ]
    `);
  });

  // Regression guard: the bare config (before the TS parser was
  // wired in) threw "Parsing error: Unexpected token" on every TS
  // file. Lint a representative .tsx fixture through the real
  // config and assert no fatal parse error — a parser
  // misconfiguration would surface here instead of failing the
  // whole `npm run lint` run cryptically.
  it("parses TS/TSX without a fatal parser error", async () => {
    const eslint = new ESLint({
      cwd: ROOT,
      overrideConfigFile: join(ROOT, "eslint.config.mjs"),
    });
    const tsx = [
      "type Props = { role: string };",
      "export function Gate({ role }: Props) {",
      "  const ok = role === 'admin';",
      "  return ok ? <span>ok</span> : null;",
      "}",
      "",
    ].join("\n");
    const results = await eslint.lintText(tsx, { filePath: "src/__fixture__/gate.tsx" });
    const fatal = results.flatMap((r) => r.messages).filter((m) => m.fatal);
    expect(
      fatal,
      `parser produced fatal errors: ${JSON.stringify(fatal, null, 2)}`
    ).toEqual([]);
  });

  // rules-of-hooks catches real runtime bugs (conditional hook
  // calls). Assert the config actually flags one as an error, so a
  // future config edit that drops the react-hooks plugin regresses
  // loudly rather than silently.
  it("flags a rules-of-hooks violation as an error", async () => {
    const eslint = new ESLint({
      cwd: ROOT,
      overrideConfigFile: join(ROOT, "eslint.config.mjs"),
    });
    const tsx = [
      "import { useState } from 'react';",
      "export function Bad({ cond }: { cond: boolean }) {",
      "  if (cond) {",
      "    const [x] = useState(0);",
      "    return <span>{x}</span>;",
      "  }",
      "  return null;",
      "}",
      "",
    ].join("\n");
    const results = await eslint.lintText(tsx, { filePath: "src/__fixture__/bad.tsx" });
    const ruleViolations = results
      .flatMap((r) => r.messages)
      .filter((m) => m.ruleId === "react-hooks/rules-of-hooks");
    expect(ruleViolations.length).toBeGreaterThan(0);
    expect(ruleViolations.every((m) => m.severity === 2)).toBe(true);
  });
});
