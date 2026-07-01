import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, rateLimit } from "../lib/ratelimit.js";

function req(ip, extraHeaders = {}) {
  return { headers: { "x-real-ip": ip, ...extraHeaders }, socket: { remoteAddress: "9.9.9.9" } };
}

describe("clientIp", () => {
  it("prefers x-real-ip", () => {
    expect(clientIp(req("1.2.3.4", { "x-forwarded-for": "5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to the first x-forwarded-for entry", () => {
    expect(clientIp({ headers: { "x-forwarded-for": " 5.6.7.8 , 10.0.0.1" } })).toBe("5.6.7.8");
  });

  it("falls back to the socket address, then 'unknown'", () => {
    expect(clientIp({ headers: {}, socket: { remoteAddress: "9.9.9.9" } })).toBe("9.9.9.9");
    expect(clientIp({ headers: {} })).toBe("unknown");
  });
});

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const RULES = [{ name: "min", limit: 3, windowMs: 60_000 }];

  it("allows up to the limit, then denies with a Retry-After hint", () => {
    const r = req("10.0.0.1");
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(r, "bucketA", RULES).allowed).toBe(true);
    }
    const denied = rateLimit(r, "bucketA", RULES);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("resets after the window elapses", () => {
    const r = req("10.0.0.2");
    for (let i = 0; i < 3; i++) rateLimit(r, "bucketB", RULES);
    expect(rateLimit(r, "bucketB", RULES).allowed).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(rateLimit(r, "bucketB", RULES).allowed).toBe(true);
  });

  it("tracks IPs independently", () => {
    for (let i = 0; i < 3; i++) rateLimit(req("10.0.0.3"), "bucketC", RULES);
    expect(rateLimit(req("10.0.0.3"), "bucketC", RULES).allowed).toBe(false);
    expect(rateLimit(req("10.0.0.4"), "bucketC", RULES).allowed).toBe(true);
  });

  it("tracks buckets independently", () => {
    const r = req("10.0.0.5");
    for (let i = 0; i < 3; i++) rateLimit(r, "bucketD", RULES);
    expect(rateLimit(r, "bucketD", RULES).allowed).toBe(false);
    expect(rateLimit(r, "bucketE", RULES).allowed).toBe(true);
  });

  it("denies without consuming quota when any rule would be exceeded", () => {
    const rules = [
      { name: "burst", limit: 2, windowMs: 1_000 },
      { name: "day", limit: 100, windowMs: 86_400_000 },
    ];
    const r = req("10.0.0.6");
    rateLimit(r, "bucketF", rules);
    rateLimit(r, "bucketF", rules);
    expect(rateLimit(r, "bucketF", rules).allowed).toBe(false);
    // After the short window resets, the earlier denials must not have burned quota.
    vi.advanceTimersByTime(1_100);
    expect(rateLimit(r, "bucketF", rules).allowed).toBe(true);
  });
});
