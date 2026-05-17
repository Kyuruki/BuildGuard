import formidable from "formidable";
import fs from "fs";

export default async function handler(req, res) {
  const form = formidable();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: "Failed to parse file" });
    }
    const filepath = files.file[0].filepath;
    const filebytes = fs.readFileSync(filepath);
    const blob = new Blob([filebytes]);
    const filename = files.file[0].originalFilename;
    const modalform = new FormData();
    modalform.append("bill", blob, filename);
    const modalResponse = await fetch(
      "https://kyuruki--billguard-analyze.modal.run",
      {
        method: "POST",
        body: modalform,
      },
    );
    const data = await modalResponse.json();
    return res.status(200).json(data);
  });
}
