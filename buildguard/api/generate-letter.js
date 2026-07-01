import { originAllowed, modalHeaders, MODAL_LETTER_URL } from "../lib/proxy.js";

const MAX_LINE_ITEMS = 50;

function strOrNull(v) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, 200) : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ detail: "Method not allowed" });
  }
  if (!originAllowed(req)) {
    return res.status(403).json({ detail: "Forbidden" });
  }

  const body = req.body;
  if (!body || typeof body !== "object" || !Array.isArray(body.line_items)) {
    return res.status(400).json({ detail: "Invalid request body." });
  }
  if (body.line_items.length === 0 || body.line_items.length > MAX_LINE_ITEMS) {
    return res.status(400).json({ detail: "Request must include between 1 and 50 line items." });
  }

  // Whitelist only the fields the backend accepts; the backend re-verifies rates.
  const payload = {
    line_items: body.line_items.map((li) => ({
      code: String(li?.code ?? ""),
      charged: Number(li?.charged ?? 0),
    })),
    patient_name: strOrNull(body.patient_name),
    provider_name: strOrNull(body.provider_name),
    account_no: strOrNull(body.account_no),
    statement_date: strOrNull(body.statement_date),
  };

  try {
    const modalResponse = await fetch(MODAL_LETTER_URL, {
      method: "POST",
      headers: modalHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const data = await modalResponse.json().catch(() => ({ detail: "Upstream error." }));
    return res.status(modalResponse.status).json(data);
  } catch {
    return res.status(502).json({ detail: "Failed to reach letter backend." });
  }
}
