// Shared helpers for the Vercel /api proxy layer.
//
// The proxy is the only client allowed to reach Modal. It (a) rejects browser
// cross-origin requests via an Origin allowlist and (b) attaches a shared secret
// so Modal can verify the caller. Modal URLs and the allowlist are env-overridable.

const DEFAULT_ALLOWED_ORIGINS = [
  "https://billguard.kyuruki.cc",
  "https://buildguard-alpha.vercel.app",
  "https://buildguard-kyurukis-projects.vercel.app",
  "https://buildguard-git-main-kyurukis-projects.vercel.app",
];

export function allowedOrigins() {
  const env = process.env.ALLOWED_ORIGINS;
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  return DEFAULT_ALLOWED_ORIGINS;
}

// Reject browser cross-origin requests. A request with no Origin header
// (server-to-server, curl, same-origin GET) passes this check — the real backend
// protection is the shared secret to Modal, not this Origin gate.
export function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (allowedOrigins().includes(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:") return false;
    // The owned custom domain (any subdomain) and THIS team's own Vercel
    // production/preview deployments only — not any buildguard-*.vercel.app tenant.
    if (hostname === "kyuruki.cc" || hostname.endsWith(".kyuruki.cc")) return true;
    if (hostname === "buildguard-alpha.vercel.app") return true;
    if (hostname.endsWith("-kyurukis-projects.vercel.app")) return true;
    return false;
  } catch {
    return false;
  }
}

export function modalHeaders(extra = {}) {
  const headers = { ...extra };
  const secret = process.env.PROXY_SHARED_SECRET;
  if (secret) headers["x-proxy-secret"] = secret;
  return headers;
}

export const MODAL_ANALYZE_URL =
  process.env.MODAL_ANALYZE_URL || "https://kyuruki--billguard-analyze.modal.run";
export const MODAL_LETTER_URL =
  process.env.MODAL_LETTER_URL || "https://kyuruki--billguard-generate-letter.modal.run";
