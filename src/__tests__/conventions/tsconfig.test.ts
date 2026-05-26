import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Snapshot the keys of compilerOptions so a future tightening
 * (e.g. dropping `allowJs`, adding `noUncheckedIndexedAccess`) is
 * a deliberate diff rather than a silent edit. The snapshot
 * intentionally pins keys + their literal values for the strict
 * flags that matter; less interesting fields (target, lib, paths)
 * stay key-only.
 */

interface Tsconfig {
  compilerOptions?: Record<string, unknown>;
}

const tsconfig = JSON.parse(
  readFileSync(join(process.cwd(), "tsconfig.json"), "utf8")
) as Tsconfig;

describe("tsconfig.json", () => {
  it("compilerOptions keys are snapshotted", () => {
    const keys = Object.keys(tsconfig.compilerOptions ?? {}).sort();
    expect(keys).toMatchInlineSnapshot(`
      [
        "allowJs",
        "esModuleInterop",
        "incremental",
        "isolatedModules",
        "jsx",
        "lib",
        "module",
        "moduleResolution",
        "noEmit",
        "paths",
        "plugins",
        "resolveJsonModule",
        "skipLibCheck",
        "strict",
        "target",
      ]
    `);
  });

  it("strict flags are pinned to their values", () => {
    // These three are the load-bearing ones — flipping any to
    // false would lower the type-safety floor.
    expect(tsconfig.compilerOptions?.strict).toBe(true);
    expect(tsconfig.compilerOptions?.noEmit).toBe(true);
    expect(tsconfig.compilerOptions?.isolatedModules).toBe(true);
  });
});
