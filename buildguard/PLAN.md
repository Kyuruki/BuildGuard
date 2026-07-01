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
- [ ] **CHECKPOINT** ✅ Phase 2 — pending user go-ahead to Phase 3 (frontend rebuild).

## Phase 3 — Frontend rebuild (full site, accessible)
- [ ] Use the frontend/web-design skill to drive visual quality.
- [ ] Client-side routing: Home, How It Works, FAQ, Privacy, About, Analyzer.
- [ ] Reuse the working analyze → results → generate-letter flow with new UI.
- [ ] Design: clean/clinical, blues + whites, high-contrast, mobile-first responsive;
      consistent components; real loading/empty/error states.
- [ ] **WCAG 2.1 AA** built-in: semantic landmarks, correct heading order, full
      keyboard operability of upload/results/letter, visible focus, form labels +
      `aria-live` error announcements, verified color contrast, alt text,
      `prefers-reduced-motion`. Upload + results table fully screen-reader usable.
- [ ] Clear disclaimers on the tool + footer/Privacy (informational only; not legal/
      medical/financial advice; not affiliated with CMS/Medicare/insurers; verify
      before acting). Privacy page: uploads processed transiently, not stored.
- [ ] **CHECKPOINT** ✅ Phase 3.

## Phase 4 — SEO + AI-crawler readiness
- [ ] Per-page title + meta description, canonical URLs, Open Graph + Twitter Card,
      social share image.
- [ ] JSON-LD: Organization + WebApplication site-wide; FAQPage on FAQ.
- [ ] `sitemap.xml`, `robots.txt`, `llms.txt`. Favicon + app icons + manifest.
- [ ] Core Web Vitals: route-level code splitting, lazy-load non-critical assets,
      optimize/compress images, avoid layout shift.
- [ ] **CHECKPOINT** ✅ Phase 4.

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
