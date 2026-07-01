# CLAUDE.md — BillGuard

> Source of truth for how BillGuard is built, run, and deployed. Keep this current
> as the code changes. Last updated: Phase 0 recon (2026-06-30).

## What it is

BillGuard is an **anonymous** medical/dental bill analyzer. A user uploads a bill
image or PDF; the app OCRs it, extracts CPT/HCPCS billing codes and dollar amounts,
compares each code to CMS Medicare reference rates, flags overcharges, and can
generate a formal dispute letter.

- **No login / no accounts** (locked decision). The app is fully anonymous.
- **Privacy-first:** uploads are meant to be processed **in memory only**. No bill
  image, OCR text, or PHI should be persisted to disk or DB. `fee_schedule` and
  `clfs_fee_schedule` are read-only reference data only.
- Code is structured so accounts + saved history *could* be added later (a
  request/session-id concept and a schema that could attach `user_id`) without a
  rewrite — but none of that exists yet.

## Repository layout

The application lives in the **`buildguard/`** subfolder of the repo (repo is
`github.com/Kyuruki/BuildGuard`).

```
buildguard/
  index.html            Vite entry HTML (SPA mount point)
  vite.config.js        Vite config (React plugin)
  eslint.config.js      ESLint flat config
  package.json          Frontend + proxy deps (react 19, formidable)
  src/
    main.jsx            React root
    App.jsx             Currently just renders <Upload/> (no router yet)
    Upload.jsx          The entire analyze -> results -> letter UI flow
    Upload.css          Component styles
    index.css           Global styles / CSS variables (currently PURPLE theme)
    assets/             hero.png, logos
  api/                  Vercel Serverless Functions (the "proxy")
    analyze.js          POST: receives upload, forwards to Modal /analyze
    generate-letter.js  POST: forwards JSON to Modal /generate_letter
  backend.py            Modal app "billguard": analyze, generate_letter, health
  load_fees.py          ONE-TIME loader for fee_schedule (already ran — DO NOT re-run)
  load_clfs.py          ONE-TIME loader for clfs_fee_schedule (already ran — DO NOT re-run)
  public/               favicon.svg, icons.svg
```

## Architecture / data flow

```
Browser (React SPA on Vercel)
    │  multipart POST /api/analyze  (field name: "file")
    ▼
Vercel Serverless Function  buildguard/api/analyze.js
    │  re-wraps file as multipart, field name "bill"
    ▼
Modal FastAPI endpoint  https://kyuruki--billguard-analyze.modal.run
    │  Stage 1 (OCR + regex) -> Stage 2 (DB fee lookup)
    ▼
Neon PostgreSQL  (fee_schedule, clfs_fee_schedule)
```

Letter flow is analogous: `Upload.jsx` → `POST /api/generate-letter` (JSON) →
`buildguard/api/generate-letter.js` → Modal `generate_letter` → Anthropic Claude.

**The Vercel `/api` proxy exists to keep the Modal URL off the client.** All Modal
calls must go through it. (Today the Modal endpoints are still publicly reachable
and unauthenticated — see SECURITY_FINDINGS.md; hardening this is a Phase 1 goal.)

## The two-stage pipeline (KEEP this design)

**Stage 1 — extraction, no AI** (`extract_line_items`, `backend.py`)
- Tesseract OCR via `pytesseract` (PDFs rasterized first with `pdf2image` + poppler).
- Regex: codes `\b(\d{5})\b`; money `\$?\s?(\d{1,3}(?:,\d{3})*\.\d{2})`.
- A line becomes a line item only if it has **both** a 5-digit code **and** a dollar
  amount on the same line (rejects zip/phone/account numbers).
- First money on the line = `charged`, second = `allowed_on_bill`, third = `balance_on_bill`.
- Caps: **20 MB** upload, **30** PDF pages.

**Stage 2 — enrichment, no AI** (`enrich_with_fee_schedule`, `backend.py`)
- Batch query `fee_schedule` with `WHERE hcpcs_code = ANY(%s)` (avoids N+1).
- Codes not found fall back to a batch query of `clfs_fee_schedule`.
- Per item computes `medicare_rate`, `overcharge_amount`, `overcharge_multiple`,
  `found_in_fee_schedule`, `rate_source` (`physician_fee_schedule` |
  `clinical_lab_fee_schedule` | `null`).
- Codes in neither table are returned `found_in_fee_schedule: false` (Unverified) —
  the app never asserts an overcharge for a code it cannot confirm.

**Letter generation** (`generate_letter`, `backend.py`)
- Separate endpoint. Uses Anthropic **`claude-haiku-4-5-20251001`**.
- Only argues items with `found_in_fee_schedule && overcharge_amount > 0`.
- Prompt is tuned: first person (the patient, not a representative); no
  "fraud"/"illegal" wording; no "authorized representative" framing; requests a
  written response within 30 days.
- Returns `{status:"ok", letter:null, message:...}` when there are no verified
  overcharges (no model call).

## Endpoints

Modal (workspace `kyuruki`, app `billguard`):
- `POST https://kyuruki--billguard-analyze.modal.run` — multipart field **`bill`**;
  returns `{status, text, line_items[], line_items_found}`. Secret: `neon-db`.
- `POST https://kyuruki--billguard-generate-letter.modal.run` — JSON body
  (`GenerateLetterRequest`); returns `{status, letter}` or `{status, letter:null, message}`.
  Secret: `anthropic-secret`.
- `GET  https://kyuruki--billguard-health.modal.run` — `{status:"ok", message:...}`.

Vercel proxy (relative paths the SPA calls):
- `POST /api/analyze` — multipart field **`file`** (formidable) → Modal `bill`.
- `POST /api/generate-letter` — JSON passthrough.

`line_items` object shape (analyze output / letter input):
`code, charged, allowed_on_bill, balance_on_bill, raw_line, found_in_fee_schedule,
rate_source, medicare_rate, overcharge_amount, overcharge_multiple`.

## Environment variables / secrets

- **Modal secret `neon-db`** → provides `DATABASE_URL` (Neon Postgres) to `analyze`.
- **Modal secret `anthropic-secret`** → provides `ANTHROPIC_API_KEY` to `generate_letter`.
- **Loaders** (`load_fees.py`, `load_clfs.py`) read `DATABASE_URL` from a local
  `.env` via `python-dotenv`. `.env` is gitignored.
- Frontend: no secrets in the client bundle. Only `VITE_`-prefixed vars are ever
  exposed to the browser; today there are none.

## Database (Neon Postgres) — ALREADY POPULATED, DO NOT WIPE OR RELOAD

| Table                | Columns                                              | Rows  | Source |
|----------------------|------------------------------------------------------|-------|--------|
| `fee_schedule`       | `hcpcs_code`, `non_facility_rate`, `facility_rate`   | 7,835 | CMS Physician Fee Schedule (PFALL26AR.txt) |
| `clfs_fee_schedule`  | `hcpcs_code` (PK), `payment_rate`                     | 2,055 | CMS Clinical Lab Fee Schedule (PUF_CLFS_CY2026_Q2V1.csv) |

- `analyze` reads `fee_schedule.non_facility_rate` and `clfs_fee_schedule.payment_rate`.
- **Never** `DROP`/`TRUNCATE`/`DELETE` these or re-run the loaders. Additive
  migrations only (`CREATE TABLE`/`ADD COLUMN`/`CREATE INDEX`), and stop-and-ask
  before anything destructive.

## Run locally

Frontend (from `buildguard/`):
```
npm install
npm run dev        # Vite dev server
npm run build      # production build -> dist/
npm run lint
```
> Local `/api/*` calls only resolve when running through the Vercel dev runtime
> (`vercel dev`) or once deployed — plain `vite dev` does not execute the
> serverless functions.

Backend (Modal):
```
modal serve backend.py     # hot-reload dev endpoints
modal run   backend.py     # one-off run
modal deploy backend.py    # publish the *.modal.run endpoints
```

Loaders — **already ran; do not re-run** (they `TRUNCATE`). Kept for provenance only.

## Deploy

- **Modal:** `modal deploy backend.py` (workspace `kyuruki`, app `billguard`).
  Secrets `neon-db` and `anthropic-secret` must exist in the Modal workspace.
- **Vercel:** project root is `buildguard/`. Vercel auto-detects Vite (build
  `npm run build`, output `dist/`) and deploys `api/*.js` as Serverless Functions.
  There is currently **no `vercel.json`** (added in Phase 1 for headers/config).

## Known gotchas

- **Windows Modal CLI path:** `modal` (v1.4.2) is installed into **Python 3.14
  (64-bit)** under the Python install-manager layout, which is NOT on PATH — hence
  the full path is required on the Windows dev box. Working invocations:
  ```
  C:\Users\karol\AppData\Local\Python\pythoncore-3.14-64\Scripts\modal.exe deploy backend.py
  ```
  or (module form, equally stable):
  ```
  C:\Users\karol\AppData\Local\Python\pythoncore-3.14-64\python.exe -m modal deploy backend.py
  ```
  (`%LOCALAPPDATA%` == `C:\Users\karol\AppData\Local`.) Swap `deploy` for `serve`/`run`
  as needed.
- **Field-name mismatch is load-bearing:** browser sends `file`; the proxy renames
  it to `bill` for Modal. Changing either side breaks upload (this bit us before —
  see commits "fixed form field name").
- **PDF page cap is checked *after* rasterization** today — a decompression-bomb
  risk being fixed in Phase 1.
- **Upload is written to a temp file on disk by formidable** in `api/analyze.js`
  today — violates the in-memory-only policy; being fixed in Phase 1.
- **Theme is currently purple**, not the clinical blue spec — the whole frontend is
  being rebuilt in Phase 3.
- **Tailwind is NOT yet installed** despite the intended stack — will be added in
  Phase 3.

## Working docs

- `PLAN.md` — the phased checklist for the current hardening/rebuild effort.
- `SECURITY_FINDINGS.md` — audited vulnerabilities/bad practices (pre-fix baseline).
- `SECURITY.md` — (Phase 5) the security model, endpoint contract, rate limits,
  data-handling policy.
