import { useState } from "react";
import "./Upload.css";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [result, setResult] = useState(null);

  const [patientName, setPatientName] = useState("");
  const [providerName, setProviderName] = useState("");

  const [letterLoading, setLetterLoading] = useState(false);
  const [letterError, setLetterError] = useState(null);
  const [letter, setLetter] = useState(null);

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setResult(null);
    setLetter(null);
    setLetterError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Analyze request failed");
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setAnalyzeError("Something went wrong analyzing this bill. Try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const overchargedItems =
    result?.line_items?.filter(
      (li) => li.found_in_fee_schedule && li.overcharge_amount > 0,
    ) ?? [];

  const totalCharged =
    result?.line_items?.reduce((sum, li) => sum + (li.charged || 0), 0) ?? 0;

  const totalOvercharge = overchargedItems.reduce(
    (sum, li) => sum + (li.overcharge_amount || 0),
    0,
  );

  const verifiedCount =
    result?.line_items?.filter((li) => li.found_in_fee_schedule).length ?? 0;

  const handleGenerateLetter = async () => {
    if (overchargedItems.length === 0) return;
    setLetterLoading(true);
    setLetterError(null);
    setLetter(null);

    try {
      const response = await fetch("/api/generate-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line_items: result.line_items,
          patient_name: patientName || null,
          provider_name: providerName || null,
        }),
      });
      if (!response.ok) throw new Error("Letter generation failed");
      const data = await response.json();
      if (data.letter) {
        setLetter(data.letter);
      } else {
        setLetterError(data.message || "No letter was generated.");
      }
    } catch (err) {
      setLetterError("Something went wrong generating the letter. Try again.");
    } finally {
      setLetterLoading(false);
    }
  };

  const handleCopyLetter = () => {
    if (letter) navigator.clipboard.writeText(letter);
  };

  const handleDownloadLetter = () => {
    if (!letter) return;
    const blob = new Blob([letter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dispute-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="billguard">
      <h1>BillGuard</h1>
      <p className="subtitle">
        Upload a medical bill to check charges against CMS Medicare reference
        rates.
      </p>

      <div className="upload-row">
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <button onClick={handleAnalyze} disabled={!file || analyzing}>
          {analyzing ? "Analyzing..." : "Analyze Bill"}
        </button>
      </div>

      {file && !result && <p className="file-name">Selected: {file.name}</p>}
      {analyzeError && <p className="error">{analyzeError}</p>}

      {result && (
        <div className="results">
          <div className="summary">
            <div>
              <span className="summary-label">Total Charged</span>
              <span className="summary-value">${totalCharged.toFixed(2)}</span>
            </div>
            <div>
              <span className="summary-label">Potential Overcharge</span>
              <span className="summary-value overcharge">
                ${totalOvercharge.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="summary-label">Verified Against CMS Data</span>
              <span className="summary-value">
                {verifiedCount} of {result.line_items.length} codes
              </span>
            </div>
          </div>

          <table className="line-items">
            <thead>
              <tr>
                <th>Code</th>
                <th>Charged</th>
                <th>Medicare Rate</th>
                <th>Overcharge</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.line_items.map((li, idx) => {
                const isOvercharged =
                  li.found_in_fee_schedule && li.overcharge_amount > 0;
                return (
                  <tr
                    key={idx}
                    className={
                      isOvercharged
                        ? "row-overcharged"
                        : !li.found_in_fee_schedule
                          ? "row-unverified"
                          : ""
                    }
                  >
                    <td>{li.code}</td>
                    <td>${li.charged.toFixed(2)}</td>
                    <td>
                      {li.medicare_rate != null
                        ? `$${li.medicare_rate.toFixed(2)}`
                        : "—"}
                    </td>
                    <td>
                      {isOvercharged
                        ? `$${li.overcharge_amount.toFixed(2)} (${li.overcharge_multiple}x)`
                        : "—"}
                    </td>
                    <td>
                      {li.found_in_fee_schedule
                        ? isOvercharged
                          ? "Overcharged"
                          : "Within range"
                        : "Unverified"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="letter-section">
            <h2>Generate Dispute Letter</h2>
            <p className="hint">
              These fields are optional — leave blank and the letter will use
              placeholders you can fill in yourself.
            </p>
            <div className="letter-inputs">
              <input
                type="text"
                placeholder="Patient name (optional)"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Provider name (optional)"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
              />
            </div>

            {overchargedItems.length === 0 ? (
              <p className="hint">
                No verified overcharges found on this bill — nothing to dispute.
              </p>
            ) : (
              <button onClick={handleGenerateLetter} disabled={letterLoading}>
                {letterLoading ? "Generating..." : "Generate Dispute Letter"}
              </button>
            )}

            {letterError && <p className="error">{letterError}</p>}

            {letter && (
              <div className="letter-output">
                <pre>{letter}</pre>
                <div className="letter-actions">
                  <button onClick={handleCopyLetter}>Copy</button>
                  <button onClick={handleDownloadLetter}>Download .txt</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
