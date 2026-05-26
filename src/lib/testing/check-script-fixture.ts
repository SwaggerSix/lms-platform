// Test-only helper. See src/lib/testing/walk.ts for the module's
// scope rules (production code must not import from this directory).

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface CheckScriptStubs {
  /** Exit code for the lint step's stub script (0 or 1). */
  lintExit: 0 | 1;
  /** Exit code for the tsc step's stub script (0, 1, or 2). */
  tscExit: 0 | 1 | 2;
}

/**
 * Build a stub `npm run check` fixture inside `dir` for the
 * fail-fast tests. Drops a package.json mirroring the three-step
 * chain (`lint && tsc && test:conventions`) with `echo X && exit N`
 * stubs for each leg, plus a tsc-stub.js the tsc step shells out
 * to. Each step echoes a marker (LINT / TSC / CONV) so the test
 * can verify both presence and order.
 *
 * Lives outside the test file so any future test that needs the
 * same chain-with-stubs setup (e.g. coverage for a new pre-step,
 * different fail mode) can reuse it.
 */
export function buildCheckScriptFixture(dir: string, stubs: CheckScriptStubs): void {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "check-fixture",
      scripts: {
        lint: `echo LINT && exit ${stubs.lintExit}`,
        tsc: "node ./tsc-stub.js",
        "test:conventions": "echo CONV && exit 0",
        check: "npm run lint && npm run tsc && npm run test:conventions",
      },
    })
  );
  mkdirSync(join(dir, "node_modules"), { recursive: true });
  writeFileSync(
    join(dir, "tsc-stub.js"),
    `console.log('TSC');process.exit(${stubs.tscExit});`
  );
}
