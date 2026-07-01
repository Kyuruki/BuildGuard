// Best-effort in-memory IP rate limiter for the Vercel proxy.
//
// LIMITATION (by design — no external store): counters live in a single serverless
// instance's memory. Vercel runs many instances and recycles them, so limits are
// approximate — a client spread across N warm instances effectively gets N× the
// limit, and counters reset on cold starts. This raises the cost of casual abuse
// but is not a hard guarantee. The Modal backend adds a second coarse per-container
// cap as defense-in-depth, and the shared secret blocks direct Modal access. Swap
// this module for Upstash/Redis if durable, cross-instance limits are needed.

const store = new Map(); // `${ip}:${bucket}:${rule}` -> { count, resetAt }

let lastPrune = 0;
function maybePrune(now) {
  if (now - lastPrune < 60_000 && store.size < 10_000) return;
  lastPrune = now;
  for (const [k, e] of store) if (now >= e.resetAt) store.delete(k);
}

export function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

// rules: [{ name, limit, windowMs }]. Denies (without incrementing) if ANY rule
// would be exceeded; otherwise increments all. Returns { allowed, retryAfterSec }.
export function rateLimit(req, bucket, rules) {
  const now = Date.now();
  maybePrune(now);
  const ip = clientIp(req);

  const entries = rules.map((r) => {
    const key = `${ip}:${bucket}:${r.name}`;
    let e = store.get(key);
    if (!e || now >= e.resetAt) e = { count: 0, resetAt: now + r.windowMs };
    return { r, key, e };
  });

  const blocked = entries.filter((x) => x.e.count + 1 > x.r.limit);
  if (blocked.length) {
    const retryMs = Math.max(...blocked.map((x) => x.e.resetAt - now));
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(retryMs / 1000)) };
  }

  for (const x of entries) {
    x.e.count += 1;
    store.set(x.key, x.e);
  }
  return { allowed: true };
}
