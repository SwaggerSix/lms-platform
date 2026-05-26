import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Run `fn` inside a fresh temp directory, removing the directory
 * (recursive + force) when `fn` returns or throws. The path is
 * passed into `fn`; the return value is propagated.
 *
 * Cuts the boilerplate that several convention tests grew:
 *
 *   beforeEach(() => workdir = mkdtempSync(...));
 *   afterEach(() => rmSync(workdir, { recursive: true, force: true }));
 *
 * Use this when the temp dir is per-test (set up once, torn down
 * once). The beforeEach/afterEach shape still wins when tests
 * share setup with mutable scope.
 */
export function withTempDir<T>(prefix: string, fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Async variant. Same contract but awaits `fn` before cleanup.
 */
export async function withTempDirAsync<T>(
  prefix: string,
  fn: (dir: string) => Promise<T>
): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
