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
- [ ] Refactor `backend.py`: clear functions/modules, type hints, docstrings,
      structured logging (no prints), centralized config. Keep Stage 1/2/letter intact.
- [ ] Validate uploads by **magic bytes** (accept only real PNG/JPEG/PDF), not extension.
- [ ] Keep 20 MB and 30-page caps; add **decompression-bomb guard** (reject absurd
      pixel dimensions / page counts *before* processing; check page count before
      rasterizing).
- [ ] Tighten every endpoint: accept only expected fields; reject malformed/oversized
      input with clean 4xx; never leak stack traces/paths/secrets/internal errors;
      return structured JSON errors.
- [ ] Lock **CORS** to the Vercel production domain(s) only — no wildcard.
- [ ] Add a **proxy↔Modal trust boundary** (shared secret/header) so Modal only
      accepts calls from the proxy (defense-in-depth; endpoints are public URLs).
- [ ] Add **security headers** via the Vercel layer (`vercel.json`): CSP, HSTS,
      `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
      restrictive `Permissions-Policy`.
- [ ] **Prompt-injection defense** on letter generation: treat OCR/client text as
      untrusted DATA, clearly delimited; instruct the model to never follow
      instructions in it; neutralize break-out attempts.
- [ ] Guarantee **no PHI/bill data written to disk or DB** anywhere (fix formidable
      temp-file write + cleanup; reconsider echoing full OCR text to client).
- [ ] Run a **pip dependency vulnerability check**; pin + patch as needed.
- [ ] Harden the `/api` proxies: method guard, size cap, field whitelist, propagate
      Modal status codes, no unhandled throws, no in-memory-only violations.
- [ ] **CHECKPOINT** ✅ Phase 1.

## Phase 2 — Rate limiting + abuse prevention
- [ ] IP-based limits primarily at the Vercel proxy; coarse hard cap in Modal as
      defense-in-depth.
- [ ] Targets: analyze ≈ 10/min & ≈ 50/day per IP; generate_letter ≈ 5/hour per IP.
- [ ] Return **HTTP 429 + Retry-After** with a friendly, UI-showable message.
- [ ] **STOP-AND-ASK** before adding Upstash/Vercel KV (external service). If declined,
      implement a best-effort per-instance limiter and document its weakness.
- [ ] **CHECKPOINT** ✅ Phase 2.

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
