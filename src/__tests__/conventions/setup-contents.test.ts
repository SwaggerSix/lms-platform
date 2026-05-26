import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * src/__tests__/setup.ts runs before every test file (vitest's
 * setupFiles). Anything added here affects every test — silent
 * additions are a stealth way to change the test surface.
 *
 * Snapshot the file contents so a change shows up as a diff and
 * forces a review pass on every test simultaneously.
 */

describe("vitest setup.ts", () => {
  it("contents are snapshotted (changes affect every test)", () => {
    const source = readFileSync(
      join(process.cwd(), "src/__tests__/setup.ts"),
      "utf8"
    );
    expect(source).toMatchInlineSnapshot(`
      "import "@testing-library/jest-dom/vitest";
      import { cleanup } from "@testing-library/react";
      import { afterEach } from "vitest";

      // Automatically cleanup after each test
      afterEach(() => {
        cleanup();
      });
      "
    `);
  });
});
