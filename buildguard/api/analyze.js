import formidable from "formidable";
import { Writable } from "node:stream";
import { originAllowed, modalHeaders, MODAL_ANALYZE_URL } from "../lib/proxy.js";

// formidable needs the raw request stream, so disable Vercel's body parsing.
export const config = { api: { bodyParser: false } };

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ detail: "Method not allowed" });
  }
  if (!originAllowed(req)) {
    return res.status(403).json({ detail: "Forbidden" });
  }

  // Buffer the single uploaded file in memory — never spool PHI to disk.
  const chunks = [];
  const form = formidable({
    maxFiles: 1,
    maxFileSize: MAX_UPLOAD_BYTES,
    fileWriteStreamHandler: () =>
      new Writable({
        write(chunk, _enc, cb) {
          chunks.push(chunk);
          cb();
        },
      }),
  });

  let uploaded;
  try {
    const [, files] = await form.parse(req);
    uploaded = files?.file?.[0];
  } catch (err) {
    if (err && /maxFileSize|options\.maxFileSize/i.test(String(err.message))) {
      return res.status(413).json({ detail: "File too large. Maximum size is 20 MB." });
    }
    return res.status(400).json({ detail: "Could not read the uploaded file." });
  }

  if (!uploaded) {
    return res.status(400).json({ detail: "No file provided." });
  }

  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) {
    return res.status(400).json({ detail: "Empty upload." });
  }

  try {
    // Forward the raw bytes (not multipart) so Modal reads them straight into
    // memory without Starlette's UploadFile spooling to disk.
    const modalResponse = await fetch(MODAL_ANALYZE_URL, {
      method: "POST",
      body: buffer,
      headers: modalHeaders({ "Content-Type": uploaded.mimetype || "application/octet-stream" }),
    });
    const data = await modalResponse.json().catch(() => ({ detail: "Upstream error." }));
    return res.status(modalResponse.status).json(data);
  } catch {
    return res.status(502).json({ detail: "Failed to reach analysis backend." });
  }
}
