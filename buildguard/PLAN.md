# PLAN.md — BillGuard hardening + rebuild

Checklist for the full effort. Check items off as they land. Keep in sync with
`CLAUDE.md` and `SECURITY_FINDINGS.md`. Work on branch
`rebuild/frontend-and-hardening`; commit in logical chunks.

**Locked decisions:** keep the stack (React+Vite+Tailwind / Vercel proxy / Modal /
Neon) and the two-stage pipeline; no auth for now but keep it addable later; full
multi-page site (Home, How It Works, FAQ, Privacy, About, Analyzer); clean/clinical
blue+white design; process uploads in memory only, persist no PHI.

---

## Phase 0 — Recon, plan, docs
- [x] Read the whole repo (frontend, `/api` proxy, `backend.py`, loaders).
- [x] Create `CLAUDE.md` (architecture, two-stage pipeline, endpoints, env/secrets,
      DB tables + row counts, run locally, deploy, gotchas).
- [x] Create `PLAN.md` (this file).
- [x] Create `SECURITY_FINDINGS.md` (every vuln/unsafe endpoint/bad practice, pre-fix).
- [ ] **CHECKPOINT: show PLAN.md + SECURITY_FINDINGS.md and wait for go-ahead.**

## Phase 1 — Backend hardening + cleanup (`backend.py`, `/api` proxy)
- [x] Refactor `backend.py`: clear functions, type hints, docstrings, structured
      logging (no prints), centralized config. Stage 1/2/letter intact. (single file
      kept for Modal simplicity; helpers cleanly sectioned.)
- [x] Validate uploads by **magic bytes** (`sniff_file_type`: PNG/JPEG/PDF), not extension.
- [x] Keep 20 MB and 30-page caps; **decompression-bomb guards**: PDF page count via
      `pdfinfo` + per-page MediaBox×UserUnit dimension check (`guard_pdf_page_sizes`,
      pypdf) *before* rasterizing; image pixel/dimension caps + `Image.MAX_IMAGE_PIXELS`.
- [x] Tighten endpoints: raw-body/manual validation, clean structured 4xx (`{detail}`),
      no stack traces/paths/secrets leaked, generic 500; **auth runs before validation**.
- [x] Lock **CORS/Origin**: `lib/proxy.js` Origin allowlist (custom domain + this team's
      Vercel hosts only, no wildcard); Modal takes no browser CORS (server-to-server).
- [x] **Proxy↔Modal trust boundary**: `X-Proxy-Secret` shared secret, constant-time
      check on both POST endpoints, **fail-closed** when unset (`proxy-auth` secret).
- [x] **Security headers** via `vercel.json`: CSP, HSTS(preload), nosniff, X-Frame DENY,
      Referrer-Policy, Permissions-Policy + function `maxDuration`.
- [x] **Prompt-injection defense**: instructions in Claude `system`; untrusted values in
      a sanitized `<bill_data>` fence; model told to treat the fence as data only.
- [x] Guarantee **no PHI persisted**: proxy buffers upload in memory (no temp file);
      backend reads raw body in memory (no UploadFile disk-spool); no OCR text echoed;
      DB reads only. (Poppler's transient auto-cleaned PDF tempdir documented honestly.)
- [x] **pip vulnerability check**: all deps pinned; OSV shows no advisories (2026-06-30).
- [x] Harden `/api` proxies: method guard, 20 MB cap, field whitelist, Origin check,
      shared-secret header, Modal status propagation, no unhandled throws.
- [x] Adversarial verification workflow run; all 9 verified findings fixed (incl. HIGH
      single-giant-page PDF raster bomb; fail-open→fail-closed).
- [ ] **CHECKPOINT** ✅ Phase 1 — pending user go-ahead to Phase 2 (rate limiting).

## Phase 2 — Rate limiting + abuse prevention
- [x] IP-based limits primarily at the Vercel proxy (`lib/ratelimit.js`); coarse
      per-container cap in Modal (`coarse_rate_limit`, keyed on forwarded `X-Client-IP`).
- [x] Targets: analyze 10/min + 50/day per IP; generate_letter 5/hour per IP.
- [x] Return **HTTP 429 + Retry-After** with a friendly, UI-showable `{detail}` message.
- [x] **Store decision: user chose best-effort in-memory** (no Upstash/KV). Implemented
      per-instance limiter; weakness (per-instance, resets on cold start, N× across
      instances) documented in the module + CLAUDE.md. Upgrade path noted.
- [x] Behavioral test: 10 allowed / 3 denied per minute, per-IP + per-bucket isolation.
- [x] **CHECKPOINT** ✅ Phase 2.

## Phase 3 — Frontend rebuild (full site, accessible)
- [x] Used the frontend-design skill for direction: an "auditor's ledger" thesis —
      ink-navy on paper-white, one medical blue, red only for overcharges; IBM Plex
      Sans + Mono; the billed-vs-Medicare reconciliation row/table as the signature.
- [x] Client-side routing (React Router v7): Home, How It Works, FAQ, Privacy, About,
      Analyzer + 404. Route-level code splitting; SPA rewrite in vercel.json.
- [x] Reused the working analyze → results → generate-letter flow (unchanged proxy
      contract) in the new UI.
- [x] Design: clean/clinical blues+whites, high-contrast (all AA verified), mobile-first;
      shared components (Container/Button/Eyebrow/Callout); real loading/empty/error states.
- [x] **WCAG 2.1 AA**: landmarks, heading order, full keyboard operability (upload dropzone
      focus ring, results table, letter), visible focus, labelled fields, `aria-live`
      status+error announcements, route-change focus/announce (guarded on mount),
      color-not-alone status badges, `prefers-reduced-motion`, scrollable-table region.
- [x] Disclaimers on the tool + footer + Privacy page (informational only; not advice;
      not affiliated with CMS/Medicare/insurers; uploads processed transiently, not stored).
- [x] Built + linted clean; screenshotted every route (desktop+mobile) via headless
      Chromium; adversarial review workflow run — all 8 verified findings fixed
      (incl. hero-total reconciliation bug, dropzone focus ring, initial-load focus).
- [x] **CHECKPOINT** ✅ Phase 3.

## Phase 4 — SEO + AI-crawler readiness
- [x] Per-page title + meta description + canonical + Open Graph + Twitter Card via a
      single `<Seo>` (React 19 native metadata, driven by route → `PAGE_META`). Verified
      exactly one description tag per route (no duplication). Branded 1200×630 `og.png`.
- [x] JSON-LD: Organization + WebApplication static in `index.html` (crawler-safe);
      FAQPage rendered on `/faq`. All validated as parseable.
- [x] `sitemap.xml`, `robots.txt` (sitemap ref + AI crawlers welcome), `llms.txt`
      (site description for AI crawlers). Branded `favicon.svg` + `favicon-32.png` +
      `apple-touch-icon.png` + `icon-192/512.png` + `site.webmanifest`.
- [x] Core Web Vitals: route-level code splitting (Phase 3), self-hosted fonts with
      `font-display: swap`, no render-blocking images / no layout shift. (Full Lighthouse
      pass → Phase 5.)
- [x] Verified via headless Chromium: rendered head tags per route + all static files 200.
- [ ] **CHECKPOINT** ✅ Phase 4 — pending user go-ahead to Phase 5 (verify, docs, deploy).

## Phase 5 — Verify, document, deploy
- [ ] Verify: security headers present; CORS locked; rate limits return 429; no
      secrets in client bundle; npm + pip audits clean; no PHI persisted;
      keyboard + screen-reader pass on core flow; Lighthouse SEO/a11y/perf checked.
- [ ] Finalize `CLAUDE.md`; write `SECURITY.md`; update `README` (setup + deploy).
- [ ] Deploy to Modal + Vercel (honoring stop conditions).
- [ ] **CHECKPOINT** ✅ Phase 5.

---

## Stop-and-ask triggers (do NOT do without approval)
- Destructive DB ops (DROP/TRUNCATE/DELETE-without-WHERE/column-dropping ALTER) or
  anything touching `fee_schedule` / `clfs_fee_schedule` data or the loaders.
- Adding a paid/hosted external service or new third-party account (e.g. Upstash/KV).
- Rotating/regenerating/changing any secret (`anthropic-secret`, `neon-db`, `DATABASE_URL`).
- Merging to `main`, force-push, rewriting history, or deleting several files at once.
- Any scope/intent ambiguity.
