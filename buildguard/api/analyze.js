export default async function handler(req, res) {
  const modalResponse = await fetch(
    "https://kyuruki--billguard-health.modal.run",
  );
  const data = await modalResponse.json();
  res.status(200).json(data);
}
