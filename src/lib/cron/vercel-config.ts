import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export interface VercelCronEntry {
  path: string;
  schedule: string;
}

interface VercelConfig {
  crons?: VercelCronEntry[];
}

let cache: { mtimeMs: number; cfg: VercelConfig } | null = null;

/**
 * Read and parse vercel.json once, then return the cached parse on
 * subsequent calls. Re-reads when the file's mtime changes so a deploy
 * (which writes a new file before booting) picks up fresh content
 * without a restart. Returns an empty config on missing/malformed file.
 *
 * Used by /api/admin/alert-config and /api/admin/cron-alert-replay so
 * they don't each pay a synchronous readFileSync per request.
 */
export function readVercelConfig(): VercelConfig {
  try {
    const p = join(process.cwd(), "vercel.json");
    if (!existsSync(p)) {
      cache = null;
      return {};
    }
    const stat = statSync(p);
    if (cache && cache.mtimeMs === stat.mtimeMs) {
      return cache.cfg;
    }
    const cfg = JSON.parse(readFileSync(p, "utf8")) as VercelConfig;
    cache = { mtimeMs: stat.mtimeMs, cfg };
    return cfg;
  } catch {
    return {};
  }
}

/** Map of cron path basename → schedule, derived from readVercelConfig(). */
export function cronJobBasenames(): string[] {
  const cfg = readVercelConfig();
  return (cfg.crons ?? []).map((c) => (c.path ?? "").split("/").pop() ?? "").filter(Boolean);
}
