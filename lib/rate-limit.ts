/**
 * Simple in-memory sliding-window rate limiter.
 *
 * ⚠  This is per-process. On multi-instance deployments (Vercel serverless)
 *    each instance tracks independently, so true global enforcement requires a
 *    DB-backed counter.  For burst protection and UX throttling this is
 *    sufficient — pair with DB-backed limits where hard enforcement is needed.
 */

interface Entry {
  timestamps: number[]
}

const store = new Map<string, Entry>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * Check and record a request for the given key.
 *
 * @param key         Unique rate-limit key, e.g. `${userId}:star`
 * @param maxRequests Max allowed requests per window
 * @param windowMs    Length of the sliding window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key) ?? { timestamps: [] }
  const windowStart = now - windowMs

  // Drop timestamps outside the current window
  const recent = entry.timestamps.filter((t) => t > windowStart)

  if (recent.length >= maxRequests) {
    // Earliest timestamp in the window determines when quota refills
    const retryAfterMs = recent[0] + windowMs - now
    store.set(key, { timestamps: recent })
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    }
  }

  recent.push(now)
  store.set(key, { timestamps: recent })

  return {
    allowed: true,
    remaining: maxRequests - recent.length,
    retryAfterSeconds: 0,
  }
}
