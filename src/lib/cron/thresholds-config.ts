import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export interface ThresholdsConfig {
  alert_webhook?: {
    adapter?: "generic" | "slack" | "pagerduty";
    min_severity?: "warn" | "critical";
    pagerduty_dedup?: "global" | "per-job";
    dry_run?: boolean;
  };
  consecutive_failures?: { window?: number; threshold?: number };
  replay?: { dedup_minutes?: number };
  thresholds?: Record<string, { warn_minutes?: number; critical_minutes?: number }>;
}

let cache: { mtimeMs: number; cfg: ThresholdsConfig; loadedAt: number } | null = null;

/**
 * Read and parse cron-thresholds.json once, then re-read only when the
 * file's mtime changes. Mirrors readVercelConfig — same lazy-fs pattern,
 * same mtime invalidation strategy. Returns an empty object on missing
 * or malformed file.
 */
export function readThresholdsConfig(): ThresholdsConfig {
  try {
    const p = join(process.cwd(), "cron-thresholds.json");
    if (!existsSync(p)) {
      cache = null;
      return {};
    }
    const stat = statSync(p);
    if (cache && cache.mtimeMs === stat.mtimeMs) {
      return cache.cfg;
    }
    const cfg = JSON.parse(readFileSync(p, "utf8")) as ThresholdsConfig;
    cache = { mtimeMs: stat.mtimeMs, cfg, loadedAt: Date.now() };
    return cfg;
  } catch {
    return {};
  }
}

export function thresholdsConfigCacheInfo(): { loaded_at: string; age_ms: number } | null {
  if (!cache) return null;
  return {
    loaded_at: new Date(cache.loadedAt).toISOString(),
    age_ms: Date.now() - cache.loadedAt,
  };
}

export function __resetThresholdsConfigCacheForTests(): void {
  cache = null;
}

/**
 * Resolve the replay-suppression window in minutes from the cached
 * config. Semantics:
 *   - 0 (explicit zero in config): idempotency is fully disabled.
 *     Operator-acknowledged "I want every click to fire."
 *   - undefined / missing key / negative / non-numeric: defaults to 5.
 *   - positive integer: use as-is.
 */
export function getReplayDedupMinutes(): number {
  const cfg = readThresholdsConfig();
  const raw = cfg.replay?.dedup_minutes;
  if (raw === 0) return 0;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0) return 5;
  return Math.floor(v);
}
