# BillGuard

Upload a medical or dental bill and check whether its charges are above CMS Medicare
reference rates. If they are, generate a formal dispute letter in one click. Free,
anonymous, and nothing you upload is stored.

**Live:** https://billguard.kyuruki.cc

## What it does

1. **Upload** a bill as an image (PNG/JPEG) or PDF.
2. **OCR** extracts the text (Tesseract). PDFs are rasterized in memory (PyMuPDF).
3. **Regex** pulls out CPT/HCPCS billing codes and dollar amounts — a line only counts if
   it has both a 5-digit code and a dollar amount.
4. **Fee-schedule lookup** checks each code against the CMS Physician Fee Schedule and the
   CMS Clinical Laboratory Fee Schedule.
5. **Results** show every line item — what you were charged, the Medicare reference rate,
   the dollar overcharge, and a status (Overcharged / Within range / Unverified).
6. **Dispute letter** — if verified overcharges are found, Claude drafts a professional,
   first-person dispute letter you can copy or download. Overcharges are re-verified
   server-side, so the letter only cites figures BillGuard confirmed against CMS data.

Codes not found in either fee schedule are flagged **Unverified** — the app never asserts
an overcharge it can't confirm.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind v4 + React Router 7 (Vercel) |
| API proxy | Vercel Serverless Functions (`/api`) — keep the Modal URL private |
| Backend | Python + FastAPI on Modal |
| OCR / PDF | Tesseract (`pytesseract`) + in-memory PDF rasterization (PyMuPDF) |
| Fee-schedule DB | PostgreSQL (Neon) — CMS PFS + CLFS reference data |
| Letter generation | Claude Haiku (Anthropic) |

## Architecture

```
Browser (SPA) ──▶ Vercel /api proxy ──(X-Proxy-Secret)──▶ Modal (FastAPI) ──▶ Neon (read-only)
                                                                └──▶ Anthropic (letters)
```

The `/api` proxy is the only intended caller of Modal; it attaches a shared secret and
enforces per-IP rate limits. See **[SECURITY.md](buildguard/SECURITY.md)** for the full
security model, endpoint contract, rate limits, and data-handling policy.

## Repo layout

The app lives in **`buildguard/`**:

```
buildguard/
  src/          React SPA (pages/, components/, content.js, index.css)
  api/          Vercel serverless proxy (analyze.js, generate-letter.js)
  lib/          Proxy helpers (proxy.js, ratelimit.js)
  public/       Static assets, icons, robots.txt, sitemap.xml, llms.txt, og.png
  backend.py    Modal app "billguard": analyze, generate_letter, health
  vercel.json   Security headers + SPA rewrite + function config
  CLAUDE.md     Source-of-truth developer docs (architecture, run, deploy, gotchas)
```

## Run locally

From `buildguard/`:

```bash
npm install
npm run dev        # Vite dev server (frontend only)
npm run build      # production build -> dist/
npm run lint
```

> The `/api/*` proxy functions only execute under the Vercel runtime (`vercel dev`) or once
> deployed — plain `vite dev` serves the frontend but not the serverless functions.

Backend (Modal): `modal serve backend.py` (dev) / `modal deploy backend.py` (publish).

## Deploy

**Prerequisites — provision the shared secret on both sides (the backend fails closed
without it):**

```bash
# 1. Create the Modal secret (key name must be exactly PROXY_SHARED_SECRET)
openssl rand -hex 32                         # generate a value
modal secret create proxy-auth PROXY_SHARED_SECRET=<value>

# 2. In Vercel → Project → Settings → Environment Variables, set:
#    PROXY_SHARED_SECRET = <same value>      (Production + Preview)
#    (optional) ALLOWED_ORIGINS, MODAL_ANALYZE_URL, MODAL_LETTER_URL
```

Existing Modal secrets `neon-db` (DATABASE_URL) and `anthropic-secret` (ANTHROPIC_API_KEY)
must also exist in the workspace.

**Deploy:**

```bash
modal deploy backend.py       # backend (Modal workspace "kyuruki", app "billguard")
# Vercel: connected to the repo (project root = buildguard/); pushes deploy automatically,
# or `vercel --prod` from buildguard/.
```

The CMS reference data is already loaded in Neon (`fee_schedule`, `clfs_fee_schedule`).
`load_fees.py` / `load_clfs.py` are one-time loaders — **do not re-run them.**

## Privacy

Uploads are processed **in memory only** and discarded when the request ends — no bill
image, OCR text, or personal/health data is saved to disk or a database. There are no
accounts. See the Privacy page and [SECURITY.md](buildguard/SECURITY.md).

## Disclaimer

BillGuard is an informational tool, **not** legal, medical, or financial advice, and is not
affiliated with CMS, Medicare, or any insurer. Medicare reference rates are a benchmark,
not a statement of what you owe — a charge above the reference rate can be legitimate.
Always verify against your own bill and plan before acting.

## Limitations

- OCR quality depends on how clearly the bill was scanned/photographed.
- Medicare rates are a reference benchmark, not a legal entitlement — negotiated rates vary.
- Only CPT/HCPCS codes in the CMS fee schedules are covered; facility fees and other
  charges may not be recognized.
