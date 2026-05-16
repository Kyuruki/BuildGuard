import formidable from "formidable";

export default function handler(req, res) {
  const form = formidable();

  form.parse(req, function (err, fields, files) {
    if (err) {
      return res.status(500).json({ error: "Failed to parse file" });
    }

    console.log(files); // see what came through
    res
      .status(200)
      .json({ status: "ok", filename: files.file[0].originalFilename });
  });
}
