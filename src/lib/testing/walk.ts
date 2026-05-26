// src/lib/testing/ — utilities used exclusively by the Vitest suite.
// Production code paths must not import from here. The module exists
// so multiple tests can share fs / fixture / walk helpers without
// each rolling its own copy. New helpers belong here only when at
// least two tests would benefit; one-off helpers stay inside their
// test file.
//
// Module map:
//   - walk.ts                  — recursive file walker for codebase scans
//   - temp-dir.ts              — withTempDir / withTempDirAsync
//   - git-fixture.ts           — initGitRepo (gpgsign-disabled init + optional branch)
//   - install-hooks-fixture.ts — temp git+package fixture for hook tests
//   - check-script-fixture.ts  — temp package.json + tsc stub for check-chain tests

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

interface WalkOptions {
  /** File extensions to include (default: .ts + .tsx). */
  extensions?: string[];
  /** Directory or file names to skip. Defaults skip node_modules + dotfiles. */
  skip?: (name: string) => boolean;
}

/**
 * Recursive synchronous file walk used by the codebase-scanning
 * convention tests. Returns absolute paths.
 *
 * Pulled out of the individual guardrail tests so they share one
 * implementation — divergent walkers were producing slightly
 * different result sets (e.g. some tests skipped node_modules,
 * others would have descended into it given the right repo layout).
 */
export function walkFiles(dir: string, options: WalkOptions = {}): string[] {
  const { extensions = [".ts", ".tsx"], skip } = options;
  const defaultSkip = (name: string) => name === "node_modules" || name.startsWith(".");
  const shouldSkip = skip ?? defaultSkip;

  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (shouldSkip(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      out.push(...walkFiles(p, options));
    } else if (s.isFile() && extensions.some((ext) => p.endsWith(ext))) {
      out.push(p);
    }
  }
  return out;
}
