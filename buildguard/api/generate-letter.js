export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const modalResponse = await fetch(
      "https://kyuruki--billguard-generate-letter.modal.run",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      },
    );

    const data = await modalResponse.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Failed to reach Modal backend" });
  }
}
