# SECURITY_FINDINGS.md — BillGuard (pre-fix baseline)

> Baseline audit of the code **as it exists before Phase 1 hardening**. This is the
> "before" snapshot; fixes are tracked in `PLAN.md` and will be recorded in
> `SECURITY.md` (Phase 5). Do not delete findings as they're fixed — mark them.

## Method

Five independent security lenses (injection / upload-DoS / endpoint-CORS-auth /
PHI-data / deps-config) were run over `backend.py`, the two `/api` proxies, and the
frontend/config, then **every finding was adversarially verified** against the real
deployment model (anonymous, stateless, browser → Vercel proxy → public Modal URL →
Neon). The verifier tried to *refute* each item.

**Outcome:** 23 raw findings, **0 rejected** (all are real weaknesses), but severity
was recalibrated hard. Because the app is anonymous, stateless, and single-user, many
"attacks" a generic checklist would rate HIGH are actually self-inflicted or inert
here (you can only attack your own request/letter). Two findings survived as genuine
HIGH: a **decompression-bomb DoS** and the **missing proxy↔Modal trust boundary**
(financial DoS on paid Claude calls). Severity below is the **adjudicated** value;
the finder's original rating is shown where it differed.

Legend: verdict = CONFIRMED (real & impactful) / PLAUSIBLE (real weakness, conditional
or derivative impact). Severity = adjudicated. "→ Phase N" = where it gets fixed.

---

## Resolution status (updated after Phase 1)

**Phase 1 (backend + proxy hardening) — DONE.** All findings below except the ones
explicitly deferred are fixed and then re-verified by an adversarial review workflow
(9 follow-up issues found, all fixed — notably a *second* decompression-bomb vector:
a single giant-page PDF, plus flipping the trust boundary from fail-open to fail-closed).

- **Fixed in Phase 1:** H1 (PDF page-count *and* per-page MediaBox×UserUnit guard before
  render), H2 (`X-Proxy-Secret` shared secret, fail-closed), M1 (proxy buffers upload in
  memory; backend reads raw body — no disk spool), M2 (image pixel/dimension caps), M3
  (letter re-verifies overcharges server-side; `code` validated; null-rate crash gone),
  L1 (proxies propagate Modal status + `{detail}` error shape), L2 (system-prompt +
  `<bill_data>` fence + sanitization), L3/L4 (20 MB caps at proxy and backend), L5 (magic
  bytes), L6 (graceful 4xx on bad input), L7 (proxy method guard + validation), L8 (proxy
  field whitelist), L9 (Origin allowlist), L10 (OCR text no longer returned), L13 (pip
  pinned; OSV-clean — apt intentionally unpinned, documented), L14 (dev-only npm advisories),
  L15 (bounded money regex), I1 (security headers via `vercel.json`).
- **L11 fully resolved:** PDF rendering was switched from pdf2image/poppler to
  **PyMuPDF** (in-memory, no subprocess, no temp files) per the user's call — the
  pipeline now touches disk nowhere. (This also removed the pypdf page-size guard,
  since PyMuPDF exposes page dimensions directly.)
- **Deferred by design:** L12 (third-party Anthropic disclosure → Phase 3 Privacy
  page). The **rate-limiting** half of H2/L8/L9 → Phase 2 (best-effort in-memory per
  the user's call; durability limits documented).

---

## HIGH

### H1 — PDF/image decompression bomb: pages rasterized before the page cap
`backend.py:246-250` · CONFIRMED · → Phase 1
`convert_from_bytes(contents)` rasterizes **every** page of the PDF into memory
*before* `len(pages) > MAX_PDF_PAGES` is checked. A small crafted PDF declaring tens
of thousands of large pages exhausts the Modal worker's RAM/CPU before any cap
applies — a genuine resource-exhaustion DoS (and it costs compute).
**Fix:** probe page count first (`pdfinfo`/`pdf2image` with `first_page`/`last_page`),
reject over-limit **before** rasterizing, and rasterize page-by-page with a cap. Pair
with H2/rate-limits so it can't be hammered. (Note: magic-byte checks do **not** stop
this — a bomb PDF has a valid `%PDF-` header; the page/pixel cap is the real control.)

### H2 — No trust boundary between the Vercel proxy and Modal (financial DoS)
`backend.py:200-235` (both proxies) · CONFIRMED · → Phase 1 (+ Phase 2)
The Modal endpoints are public `*.modal.run` URLs with **no shared secret / auth**.
Anyone who learns the URL calls `analyze`/`generate_letter` **directly**, bypassing
any proxy-side rate limiting. `generate_letter` triggers a paid Claude call, so this
is a direct **cost/financial DoS** on `anthropic-secret`, and the root cause that
makes several cost-amplification findings below matter.
**Fix:** require a shared secret/HMAC header on Modal that only the proxy knows;
reject direct calls. Combine with rate limiting (Phase 2). This is defense-in-depth,
not auth for users (the app stays anonymous).

---

## MEDIUM

### M1 — Uploaded bill written to Vercel `/tmp` by formidable and never deleted
`api/analyze.js:5-25` · CONFIRMED · → Phase 1  *(found by two lenses; merged)*
`formidable()` spools the upload to a temp file (`files.file[0].filepath`), which is
read back with `fs.readFileSync` and **never unlinked**. This violates the locked
**in-memory-only** policy — PHI (the bill image) lands on the serverless filesystem,
and the temp file leaks.
**Fix:** keep the upload in memory (`fileWriteStreamHandler` to a buffer) or `unlink`
in a `finally`; enforce the size cap here too (see L4).

### M2 — No `MAX_IMAGE_PIXELS` guard on the image path (pixel bomb)
`backend.py:257-259` · CONFIRMED · → Phase 1
`Image.open` + `pytesseract` run with PIL's default warn-only decompression-bomb
threshold. A small file that decodes to an enormous pixel grid exhausts RAM/CPU.
**Fix:** set an explicit `Image.MAX_IMAGE_PIXELS`, catch `DecompressionBombError`,
and reject oversized dimensions before OCR.

### M3 — `generate_letter` trusts client-supplied `line_items` (+ latent 500 crash)
`backend.py:200-224` (filter `158-175`) · PLAUSIBLE (finder HIGH → MEDIUM) · → Phase 1
`Upload.jsx` posts `result.line_items` **back** to the letter endpoint, and the
backend re-computes nothing — a client can fabricate any codes/overcharges. Because
the caller is also the only reader of the letter, the injection impact is modest, but
two real problems remain: (a) unvalidated attacker-controlled data drives a **paid**
Claude call (cost amplification — see H2), and (b) a **latent crash**: an item with
`found_in_fee_schedule=true`, `overcharge_amount>0`, `medicare_rate=null` passes the
filter but then `f"${li.medicare_rate:.2f}"` raises `TypeError` → unhandled 500.
There's also an **integrity** angle: since the letter cites client-supplied
`medicare_rate`/`overcharge_amount` verbatim, anyone can produce an official-looking,
CMS-referencing dispute letter with entirely invented rates — undermining the
product's core "never assert an unverified overcharge" guarantee.
**Fix (must be in `backend.py`, since the proxy is bypassable):** re-establish the
trust boundary server-side — in `generate_letter`, **ignore** client
`medicare_rate`/`overcharge_amount`/`found_in_fee_schedule` and **re-run
`enrich_with_fee_schedule`** on the submitted codes so the letter only ever cites
server-verified rates. Plus Pydantic validators — constrain `code` (`^[0-9A-Z]{3,7}$`),
cap `len(line_items)` (e.g. ≤ 50), bound string lengths; guard `medicare_rate`
presence for overcharged items (fixes the latent crash).

---

## LOW  (real weaknesses; conditional / derivative impact)

### L1 — Proxies swallow Modal's status code (always return 200)
`api/analyze.js:24`, `api/generate-letter.js:17` · CONFIRMED · → Phase 1
Both proxies `res.status(200).json(data)` even when Modal returned 4xx/5xx, so the
frontend's `if (!response.ok)` never fires and the UI mis-handles/looks-broken on real
errors. **Fix:** propagate `modalResponse.status`.

### L2 — Prompt injection: client/OCR strings interpolated raw into the Claude prompt
`backend.py:155-197` · PLAUSIBLE (finder HIGH → LOW) · → Phase 1
`patient_name`, `provider_name`, `account_no`, `statement_date` (and OCR-derived text)
are concatenated into the prompt with no data/instruction separation. Impact is
**self-injection** (attacker controls prompt and reads own output; no second user, no
secrets in prompt), so low — but still worth hardening and it interacts with the M3
cost/crash issues. **Fix:** wrap untrusted values in clear delimiters, instruct the
model to treat them strictly as data and ignore any embedded instructions, cap lengths.

### L3 — 20 MB cap enforced only after the full body is read into memory
`backend.py:236-239` · PLAUSIBLE · → Phase 1
`await bill.read()` loads the entire body before the size check. Mitigate with a proxy
size cap (L4) and a coarse Modal guard. (Low: Modal buffers the body regardless.)

### L4 — Vercel formidable has no size cap (200 MB default) and spools to disk
`api/analyze.js:5-15` · PLAUSIBLE · → Phase 1
No `maxFileSize`; large uploads spool to disk then `readFileSync` into function memory.
**Fix:** set `maxFileSize` to 20 MB, reject oversized with 413, keep in memory (M1).

### L5 — No magic-byte validation; routing on client `content_type`/`filename`
`backend.py:241-244` · PLAUSIBLE · → Phase 1
Type is chosen from client-controlled fields. Low security impact on its own (doesn't
enable the raster bomb), but adds robustness. **Fix:** sniff `%PDF-`/PNG/JPEG magic
bytes and accept only those (input hygiene; not the DoS control).

### L6 — Malformed/truncated image or PDF → unhandled exception → 500
`backend.py:246-259` · PLAUSIBLE · → Phase 1
No `try/except` around decode/OCR, so junk input returns an opaque 500 (robustness/UX,
not availability — each 500 is isolated). **Fix:** catch decode/OCR errors
(`UnidentifiedImageError`, `PDFPageCountError`, `DecompressionBombError`,
`TesseractError`, `OSError`) → clean 400/415; **do not** wrap the DB enrich step, and
re-raise the intentional `MAX_PDF_PAGES` HTTPException.

### L7 — `analyze.js` has no method guard / no try-catch; crashes on missing file field
`api/analyze.js:4-26` · PLAUSIBLE · → Phase 1
`files.file[0]` throws (unhandled) if the field is absent; any method is accepted.
**Fix:** guard `POST`, validate the field exists, wrap in try/catch → structured 4xx.

### L8 — `generate-letter.js` forwards `req.body` unvalidated and uncapped
`api/generate-letter.js:12` · PLAUSIBLE · → Phase 1
Whole body passthrough (no size/shape/content-type check). Bypassable, so the real
control is backend validation (M3) + the Modal trust boundary (H2). **Fix:** whitelist
fields + size cap at the proxy as defense-in-depth.

### L9 — No CORS/Origin lockdown on the Vercel `/api` proxy
`api/analyze.js:4-26` · PLAUSIBLE · → Phase 1
`/api/analyze` accepts CORS-safelisted multipart, so a cross-origin page can trigger
OCR compute via a victim's browser (response isn't readable). `/api/generate-letter`
sends JSON → triggers a blocking preflight, so it is **not** drive-by-able. Note:
setting `Access-Control-Allow-Origin` gates *response reading*, not request execution.
**Fix:** server-side Origin/Referer allowlist in the handlers (reject foreign Origin);
real compute/cost protection is H2 + rate limits.

### L10 — `analyze` echoes full raw OCR text (and `raw_line`) back to the client
`backend.py:264-269` · PLAUSIBLE · → Phase 1
The response includes the entire OCR `text` and per-item `raw_line`, though the UI
never displays them — more PHI over the wire than needed. **Fix:** drop `text` from the
response (or gate behind a debug flag); trim `raw_line`.

### L11 — PDF path transiently writes bill images to disk on Modal (poppler)
`backend.py:246-255` · PLAUSIBLE · → Phase 1 (document)
`pdf2image`/poppler may write intermediate images to Modal's ephemeral disk.
**Fix/plan:** prefer in-memory conversion; document that Modal's FS is ephemeral and
nothing is persisted beyond the request.

### L12 — Patient/bill-derived data sent to Anthropic without user disclosure
`backend.py:177-219` · PLAUSIBLE · → Phase 3 (Privacy page)
The letter prompt sends bill-derived data (and any patient name) to a third party.
Necessary for the feature, but undisclosed. **Fix:** state it on the Privacy page +
tool disclaimer (no code change required).

### L13 — Unpinned Python deps (pip + apt) in the Modal image
`backend.py:12-16` · PLAUSIBLE · → Phase 1
`fastapi[standard], pytesseract, Pillow, psycopg2-binary, anthropic, pdf2image` (and
apt packages) are unpinned → non-reproducible builds / supply-chain drift.
**Fix:** pin versions; run a pip vulnerability check.

### L14 — Dev-only npm advisories (vite HIGH, @babel/core LOW)
`package.json` · PLAUSIBLE · → Phase 1
Both are build/dev-time only (no runtime/production exposure) but should be upgraded.
**Fix:** `npm audit fix` / bump vite.

### L15 — `MONEY_PATTERN` backtracking on long OCR lines
`backend.py:25` · PLAUSIBLE · → Phase 1
Potential quadratic backtracking against pathologically long single lines. Low (OCR
lines are short), but cheap to bound. **Fix:** anchor/limit the pattern or cap line
length before matching.

---

## INFO  (defense-in-depth, no live exploit here)

### I1 — No security headers and no CSP
`index.html`, missing `vercel.json` · PLAUSIBLE → INFO · → Phase 1/4
No `vercel.json` means no CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, or `Permissions-Policy`; `index.html` has no CSP meta backup. No
current exploit (app is anonymous/stateless, letter rendered via React-escaped
`<pre>{letter}</pre>`, no `dangerouslySetInnerHTML`, Vercel already forces HTTPS/HSTS
on `*.vercel.app`). Still, add them as hardening. **Fix:** `vercel.json` `headers`
block; roll CSP out as `Content-Security-Policy-Report-Only` first, then enforce.

---

## Cross-cutting themes (fix order)
1. **Trust boundary + rate limiting (H2 → Phase 1/2)** is the root mitigation for every
   "cost/compute amplification" item (L8, L9, M3, and part of H1).
2. **In-memory-only (M1, L4, L10, L11)** — stop writing PHI to disk and stop echoing it.
3. **Resource caps before work (H1, M2, L3, L5)** — validate/limit before OCR.
4. **Graceful validation (L1, L6, L7, M3-crash)** — clean 4xx, never 500 + no swallowed
   status.
