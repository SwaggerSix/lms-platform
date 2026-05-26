import { describe, it, expect } from "vitest";

/**
 * Smoke test for the `@infra` marker detector used by
 * conventions-doc-coverage to opt tests out of the doc-table
 * coverage check. The live test scans real files; this proves
 * the regex behaves on crafted sources (marker present / absent /
 * past the 40-line window).
 *
 * Detector logic duplicated inline to keep dependencies minimal.
 */

const INFRA_MARKER = "@infra";

function isInfra(source: string): boolean {
  const head = source.split("\n").slice(0, 40).join("\n");
  return head.includes(INFRA_MARKER);
}

describe("@infra marker detector", () => {
  it("detects the marker inside a JSDoc block", () => {
    const src = `/**\n * Description.\n *\n * @infra\n */\n`;
    expect(isInfra(src)).toBe(true);
  });

  it("rejects a file without the marker", () => {
    const src = `/**\n * Description.\n */\nimport { x } from "y";\n`;
    expect(isInfra(src)).toBe(false);
  });

  it("only scans the first 40 lines (marker past the window is missed)", () => {
    const lines = Array.from({ length: 50 }, () => "// pad").concat([
      "// @infra",
    ]);
    expect(isInfra(lines.join("\n"))).toBe(false);
  });

  it("catches the marker even outside a JSDoc block as long as it's in the head", () => {
    // The convention is to use it in a docstring, but the detector
    // is permissive — `// @infra` at line 5 works fine too.
    const src = `import x from "y";\n\n// @infra\n`;
    expect(isInfra(src)).toBe(true);
  });

  it("a string that contains `@infra` substring still counts (best-effort match)", () => {
    // We accept this looseness: a test that mentions "@infra" in a
    // comment but isn't actually infra is rare enough that the
    // simpler detector wins over a stricter parser.
    const src = `/**\n * See @infra-pattern docs.\n */\n`;
    expect(isInfra(src)).toBe(true);
  });
});
