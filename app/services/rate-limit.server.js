const hits = new Map();

/**
 * Simple in-process rate limiter (per process). Suitable for single-instance apps.
 * @returns {boolean} true if allowed, false if limited
 */
export function checkRateLimit(key, { limit = 30, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    hits.set(key, { windowStart: now, count: 1 });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("cf-connecting-ip") || "unknown";
}
