import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/generate-letter.js";

const savedEnv = { ...process.env };
let nextIp = 1;

function fakeRes() {
  const res = { statusCode: null, headers: {}, body: null };
  res.setHeader = (k, v) => {
    res.headers[k] = v;
  };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    return res;
  };
  return res;
}

// Each test gets a fresh IP so the module-level rate limiter never interferes.
function fakeReq(body, overrides = {}) {
  return {
    method: "POST",
    headers: { "x-real-ip": `172.16.0.${nextIp++}` },
    body,
    ...overrides,
  };
}

const VALID_BODY = { line_items: [{ code: "99213", charged: 250 }] };

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ status: 200, json: async () => ({ status: "ok", letter: "Dear..." }) })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...savedEnv };
});

describe("POST /api/generate-letter", () => {
  it("rejects non-POST methods", async () => {
    const res = fakeRes();
    await handler(fakeReq(VALID_BODY, { method: "GET" }), res);
    expect(res.statusCode).toBe(405);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects disallowed origins", async () => {
    const res = fakeRes();
    const req = fakeReq(VALID_BODY);
    req.headers.origin = "https://evil.example";
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a missing or malformed body", async () => {
    for (const body of [undefined, null, "text", { line_items: "nope" }]) {
      const res = fakeRes();
      await handler(fakeReq(body), res);
      expect(res.statusCode).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects empty and oversized line_items lists", async () => {
    let res = fakeRes();
    await handler(fakeReq({ line_items: [] }), res);
    expect(res.statusCode).toBe(400);

    res = fakeRes();
    const tooMany = Array.from({ length: 51 }, () => ({ code: "99213", charged: 1 }));
    await handler(fakeReq({ line_items: tooMany }), res);
    expect(res.statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards only whitelisted fields and truncates free text", async () => {
    process.env.PROXY_SHARED_SECRET = "s3cret";
    const res = fakeRes();
    const req = fakeReq({
      line_items: [
        { code: "99213", charged: 250, medicare_rate: 1, overcharge_amount: 999, evil: true },
      ],
      patient_name: "A".repeat(300),
      provider_name: "Clinic",
      account_no: "  ",
      statement_date: "2026-01-01",
      extra_field: "dropped",
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain("modal.run");
    expect(opts.headers["x-proxy-secret"]).toBe("s3cret");
    expect(opts.headers["x-client-ip"]).toBe(req.headers["x-real-ip"]);

    const payload = JSON.parse(opts.body);
    expect(Object.keys(payload).sort()).toEqual([
      "account_no",
      "line_items",
      "patient_name",
      "provider_name",
      "statement_date",
    ]);
    // Client-supplied rates and unknown fields never reach the backend.
    expect(payload.line_items[0]).toEqual({ code: "99213", charged: 250 });
    expect(payload.patient_name).toHaveLength(200);
    expect(payload.account_no).toBeNull();
    expect(payload.statement_date).toBe("2026-01-01");
  });

  it("propagates the upstream status and body", async () => {
    fetch.mockResolvedValueOnce({ status: 429, json: async () => ({ detail: "Rate limit exceeded." }) });
    const res = fakeRes();
    await handler(fakeReq(VALID_BODY), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ detail: "Rate limit exceeded." });
  });

  it("maps upstream timeouts to 504 and network errors to 502", async () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    fetch.mockRejectedValueOnce(timeout);
    let res = fakeRes();
    await handler(fakeReq(VALID_BODY), res);
    expect(res.statusCode).toBe(504);

    fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    res = fakeRes();
    await handler(fakeReq(VALID_BODY), res);
    expect(res.statusCode).toBe(502);
  });

  it("rate limits repeat callers from the same IP with Retry-After", async () => {
    const ip = "172.16.99.1";
    let last;
    for (let i = 0; i < 6; i++) {
      last = fakeRes();
      await handler(fakeReq(VALID_BODY, { headers: { "x-real-ip": ip } }), last);
    }
    expect(last.statusCode).toBe(429);
    expect(Number(last.headers["Retry-After"])).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledTimes(5);
  });
});
