import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/analyze.js";

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

// Build a request stream carrying a real multipart body, the way Vercel hands
// the raw stream to formidable (bodyParser is disabled for this route).
function multipartReq({ fieldName = "file", filename = "bill.png", type = "image/png", content = Buffer.from("") } = {}) {
  const boundary = "----vitest0123456789";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`,
    ),
    Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const req = Readable.from([body]);
  req.method = "POST";
  req.headers = {
    "content-type": `multipart/form-data; boundary=${boundary}`,
    "content-length": String(body.length),
    "x-real-ip": `172.17.0.${nextIp++}`,
  };
  return req;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      status: 200,
      json: async () => ({ status: "ok", line_items: [], line_items_found: 0 }),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/analyze", () => {
  it("rejects non-POST methods", async () => {
    const res = fakeRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it("rejects disallowed origins", async () => {
    const res = fakeRes();
    await handler({ method: "POST", headers: { origin: "https://evil.example", "x-real-ip": "172.17.100.1" } }, res);
    expect(res.statusCode).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the uploaded bytes to Modal as a raw body and passes the response through", async () => {
    const content = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    const req = multipartReq({ content });
    const res = fakeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "ok", line_items: [], line_items_found: 0 });

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain("modal.run");
    expect(Buffer.compare(opts.body, content)).toBe(0);
    expect(opts.headers["Content-Type"]).toBe("image/png");
    expect(opts.headers["x-client-ip"]).toBe(req.headers["x-real-ip"]);
  });

  it("returns 400 when the form has no 'file' field", async () => {
    const res = fakeRes();
    await handler(multipartReq({ fieldName: "other", content: Buffer.from("x") }), res);
    expect(res.statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 on an empty upload", async () => {
    const res = fakeRes();
    await handler(multipartReq({ content: Buffer.from("") }), res);
    expect(res.statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not parseable multipart", async () => {
    const req = Readable.from([Buffer.from("not multipart at all")]);
    req.method = "POST";
    req.headers = {
      "content-type": "multipart/form-data; boundary=missing",
      "x-real-ip": "172.17.100.2",
    };
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("propagates upstream error statuses", async () => {
    fetch.mockResolvedValueOnce({ status: 415, json: async () => ({ detail: "Unsupported file." }) });
    const res = fakeRes();
    await handler(multipartReq({ content: Buffer.from("data") }), res);
    expect(res.statusCode).toBe(415);
    expect(res.body).toEqual({ detail: "Unsupported file." });
  });

  it("maps upstream timeouts to 504 and network errors to 502", async () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    fetch.mockRejectedValueOnce(timeout);
    let res = fakeRes();
    await handler(multipartReq({ content: Buffer.from("data") }), res);
    expect(res.statusCode).toBe(504);

    fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    res = fakeRes();
    await handler(multipartReq({ content: Buffer.from("data") }), res);
    expect(res.statusCode).toBe(502);
  });
});
