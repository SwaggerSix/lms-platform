import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, writeFileSync, rmSync, utimesSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  readVercelConfig,
  cronJobBasenames,
  vercelConfigCacheInfo,
  __resetVercelConfigCacheForTests,
} from "@/lib/cron/vercel-config";

// readVercelConfig reads vercel.json from process.cwd(). The tests
// chdir into a temp directory per test, write fixture files, then
// reset cwd + the cache in afterEach. Cache is module-singleton so
// tests must run serially with respect to cache state.
//
// `it.sequential` would be the right marker but vitest 4 already runs
// describe-block tests in declaration order. We just rely on the
// per-test reset.

function writeVercelJson(dir: string, body: object): void {
  writeFileSync(join(dir, "vercel.json"), JSON.stringify(body));
}

describe("readVercelConfig — mtime cache invalidation", () => {
  let originalCwd: string;
  let dir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    dir = mkdtempSync(join(tmpdir(), "vercel-cache-"));
    process.chdir(dir);
    __resetVercelConfigCacheForTests();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    __resetVercelConfigCacheForTests();
  });

  it("returns empty config when vercel.json is missing", () => {
    const cfg = readVercelConfig();
    expect(cfg).toEqual({});
    expect(vercelConfigCacheInfo()).toBeNull();
  });

  it("parses vercel.json and caches the result", () => {
    writeVercelJson(dir, {
      crons: [{ path: "/api/cron/a", schedule: "0 * * * *" }],
    });
    const first = readVercelConfig();
    expect(first.crons).toHaveLength(1);
    expect(first.crons?.[0].path).toBe("/api/cron/a");

    const info = vercelConfigCacheInfo();
    expect(info).not.toBeNull();
    expect(info!.age_ms).toBeGreaterThanOrEqual(0);

    // A second call returns the same parse without re-reading. We can
    // observe this indirectly: the parsed config is referentially
    // identical (since we return the cached object).
    const second = readVercelConfig();
    expect(second).toBe(first);
  });

  it("re-reads when mtime changes", async () => {
    writeVercelJson(dir, { crons: [{ path: "/api/cron/a", schedule: "0 * * * *" }] });
    const first = readVercelConfig();
    expect(first.crons).toHaveLength(1);

    // Touch the file with a future mtime so the cache invalidates
    // (filesystems with sub-second resolution sometimes give same
    // mtimeMs for back-to-back writes).
    const future = (Date.now() + 5000) / 1000;
    writeVercelJson(dir, {
      crons: [
        { path: "/api/cron/a", schedule: "0 * * * *" },
        { path: "/api/cron/b", schedule: "0 0 * * *" },
      ],
    });
    utimesSync(join(dir, "vercel.json"), future, future);

    const second = readVercelConfig();
    expect(second).not.toBe(first);
    expect(second.crons).toHaveLength(2);
  });

  it("cronJobBasenames derives names from cached config", () => {
    writeVercelJson(dir, {
      crons: [
        { path: "/api/cron/foo-job", schedule: "* * * * *" },
        { path: "/api/cron/bar-job", schedule: "* * * * *" },
        { path: "noisy/no-leading-slash", schedule: "* * * * *" },
      ],
    });
    const names = cronJobBasenames();
    expect(names).toEqual(["foo-job", "bar-job", "no-leading-slash"]);
  });

  it("returns empty config when vercel.json is malformed JSON", () => {
    writeFileSync(join(dir, "vercel.json"), "{ not valid json");
    const cfg = readVercelConfig();
    expect(cfg).toEqual({});
  });

  it("clears cache when file is deleted between reads", () => {
    writeVercelJson(dir, { crons: [{ path: "/api/cron/a", schedule: "0 * * * *" }] });
    expect(readVercelConfig().crons).toHaveLength(1);
    rmSync(join(dir, "vercel.json"));
    expect(readVercelConfig()).toEqual({});
    expect(vercelConfigCacheInfo()).toBeNull();
  });
});
