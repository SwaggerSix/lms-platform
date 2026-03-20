/**
 * Rate limiter with two tiers:
 * - In-memory Map for fast path (works within a single serverless instance)
 * - Redis via Upstash when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set
 *
 * All exports are async to support Redis-backed limiting transparently.
 */

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Clean up stale entries on each call (bounded by time check)
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60000) return; // every 60 seconds
  lastCleanup = now;
  for (const [key, record] of rateLimitMap) {
    if (now > record.resetTime) rateLimitMap.delete(key);
  }
}

/**
 * In-memory rate limiter (fallback).
 */
function inMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  cleanup();
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }

  record.count++;
  return { success: true, remaining: limit - record.count };
}

/**
 * Redis-backed rate limiter using Upstash REST API.
 * Only used when UPSTASH_REDIS_REST_URL is configured.
 */
async function redisRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean; remaining: number }> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL!;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const windowSeconds = Math.ceil(windowMs / 1000);
  const redisKey = `ratelimit:${key}`;

  try {
    // INCR + EXPIRE pattern via Upstash REST API
    const incrRes = await fetch(`${redisUrl}/incr/${redisKey}`, {
      headers: { Authorization: `Bearer ${redisToken}` },
    });
    const { result: count } = await incrRes.json();

    // Set expiry on first request in window
    if (count === 1) {
      await fetch(`${redisUrl}/expire/${redisKey}/${windowSeconds}`, {
        headers: { Authorization: `Bearer ${redisToken}` },
      });
    }

    const remaining = Math.max(0, limit - count);
    return { success: count <= limit, remaining };
  } catch {
    // Redis failure — fall back to in-memory
    return inMemoryRateLimit(key, limit, windowMs);
  }
}

/**
 * Main rate limit function (async). Uses Redis if configured, otherwise in-memory.
 * All route handlers should `await` this call.
 */
export async function rateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60000
): Promise<{ success: boolean; remaining: number }> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return redisRateLimit(key, limit, windowMs);
  }
  return inMemoryRateLimit(key, limit, windowMs);
}

/**
 * Async rate limit function — alias kept for backwards compatibility.
 */
export const rateLimitAsync = rateLimit;
