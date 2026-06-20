import modal
import re
import os
import asyncio
from fastapi import File, UploadFile, HTTPException
from io import BytesIO
from PIL import Image
import pytesseract
from typing import List, Optional
from pydantic import BaseModel

image = (
    modal.Image.debian_slim()
    .pip_install("fastapi[standard]", "pytesseract", "Pillow", "psycopg2-binary", "anthropic", "pdf2image")
    .apt_install("tesseract-ocr", "poppler-utils")
)

app = modal.App("billguard", image=image)

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB
MAX_PDF_PAGES = 30

# --- Stage 1 extraction patterns (no AI) ---
CODE_PATTERN = re.compile(r'\b(\d{5})\b')
MONEY_PATTERN = re.compile(r'\$?\s?(\d{1,3}(?:,\d{3})*\.\d{2})')


def extract_line_items(text):
    """
    Pulls structured billing line items out of raw OCR text using regex only.
    A 5-digit code is only kept if its line also contains a dollar amount --
    this filters out zip codes, account numbers, and other incidental 5-digit
    values that aren't actually billing codes.
    """
    line_items = []
    for line in text.split('\n'):
        code_match = CODE_PATTERN.search(line)
        if not code_match:
            continue
        code = code_match.group(1)

        money_matches = MONEY_PATTERN.findall(line)
        if not money_matches:
            continue

        amounts = [float(m.replace(',', '')) for m in money_matches]
        charged = amounts[0]
        allowed = amounts[1] if len(amounts) > 1 else None
        balance = amounts[2] if len(amounts) > 2 else None

        line_items.append({
            "code": code,
            "charged": charged,
            "allowed_on_bill": allowed,
            "balance_on_bill": balance,
            "raw_line": line.strip()
        })
    return line_items


def enrich_with_fee_schedule(line_items):
    """
    Stage 2 (DB step, still no AI): looks up each extracted code first in
    fee_schedule (CMS Physician Fee Schedule -- office visits, imaging,
    procedures), then falls back to clfs_fee_schedule (CMS Clinical
    Laboratory Fee Schedule -- lab tests, venipuncture) if not found there.
    Acts as a validity check too -- if a code isn't in either table, it's
    flagged as unverified rather than silently trusted.
    Uses batched queries to avoid N+1 round-trips.
    """
    import psycopg2

    if not line_items:
        return []

    database_url = os.environ["DATABASE_URL"]
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    codes = [item["code"] for item in line_items]

    cur.execute(
        "SELECT hcpcs_code, non_facility_rate FROM fee_schedule WHERE hcpcs_code = ANY(%s)",
        (codes,)
    )
    physician_rates = {row[0]: float(row[1]) for row in cur.fetchall()}

    remaining_codes = [c for c in codes if c not in physician_rates]
    clfs_rates = {}
    if remaining_codes:
        cur.execute(
            "SELECT hcpcs_code, payment_rate FROM clfs_fee_schedule WHERE hcpcs_code = ANY(%s)",
            (remaining_codes,)
        )
        clfs_rates = {row[0]: float(row[1]) for row in cur.fetchall()}

    cur.close()
    conn.close()

    enriched = []
    for item in line_items:
        code = item["code"]

        if code in physician_rates:
            medicare_rate = physician_rates[code]
            source = "physician_fee_schedule"
        elif code in clfs_rates:
            medicare_rate = clfs_rates[code]
            source = "clinical_lab_fee_schedule"
        else:
            enriched.append({
                **item,
                "found_in_fee_schedule": False,
                "rate_source": None,
                "medicare_rate": None,
                "overcharge_amount": None,
                "overcharge_multiple": None
            })
            continue

        overcharge_amount = round(item["charged"] - medicare_rate, 2)
        overcharge_multiple = round(item["charged"] / medicare_rate, 2) if medicare_rate > 0 else None

        enriched.append({
            **item,
            "found_in_fee_schedule": True,
            "rate_source": source,
            "medicare_rate": medicare_rate,
            "overcharge_amount": overcharge_amount,
            "overcharge_multiple": overcharge_multiple
        })

    return enriched


class LineItemIn(BaseModel):
    code: str
    charged: float
    medicare_rate: Optional[float] = None
    overcharge_amount: Optional[float] = None
    overcharge_multiple: Optional[float] = None
    found_in_fee_schedule: bool = False
    rate_source: Optional[str] = None
    raw_line: Optional[str] = None


class GenerateLetterRequest(BaseModel):
    line_items: List[LineItemIn]
    provider_name: Optional[str] = None
    patient_name: Optional[str] = None
    account_no: Optional[str] = None
    statement_date: Optional[str] = None


def build_dispute_letter_prompt(req: GenerateLetterRequest) -> Optional[str]:
    # Only argue the items that are actually verified and overcharged --
    # never assert an overcharge for a code we couldn't confirm in CMS data.
    overcharged = [
        li for li in req.line_items
        if li.found_in_fee_schedule and li.overcharge_amount and li.overcharge_amount > 0
    ]

    if not overcharged:
        return None

    lines = []
    for li in overcharged:
        source_label = "CMS Physician Fee Schedule" if li.rate_source == "physician_fee_schedule" else "CMS Clinical Laboratory Fee Schedule"
        multiple_str = f"{li.overcharge_multiple:.2f}x reference rate" if li.overcharge_multiple is not None else "unknown multiple"
        lines.append(
            f"- CPT/HCPCS {li.code}: billed ${li.charged:.2f}, "
            f"Medicare reference rate ${li.medicare_rate:.2f} ({source_label}), "
            f"overcharge ${li.overcharge_amount:.2f} ({multiple_str})"
        )
    line_items_block = "\n".join(lines)

    prompt = f"""You are drafting a formal billing dispute letter on behalf of a patient to a medical provider's billing department.

Patient: {req.patient_name or "[Patient Name]"}
Provider: {req.provider_name or "[Provider Name]"}
Account No: {req.account_no or "[Account Number]"}
Statement Date: {req.statement_date or "[Statement Date]"}

The following charges were billed well above the CMS Medicare reference rate for the same procedure code:
{line_items_block}

Write a professional, factual dispute letter that:
- Is written in the first person, as the patient themself addressing their own bill -- NOT as a representative, advocate, or third party writing "on behalf of" the patient
- States the patient is requesting a review of the listed charges
- Cites each code, the amount billed, and the CMS Medicare reference rate as a benchmark (not a legal entitlement to that exact rate, just a reasonable reference point)
- Politely requests an itemized justification or an adjustment for charges significantly above the reference rate
- Avoids accusatory language (no "fraud" or "illegal") -- frame it as a request for clarification/review
- Closes with a request for a written response within 30 days
- Signs off with just the patient's name -- no "Authorized Representative," no "On behalf of" framing, no second signature block

Output only the letter text, formatted as a standard business letter with no preamble or commentary before or after it."""
    return prompt


@app.function(secrets=[modal.Secret.from_name("anthropic-secret")])
@modal.fastapi_endpoint(method="POST")
async def generate_letter(req: GenerateLetterRequest):
    import anthropic

    prompt = build_dispute_letter_prompt(req)

    if prompt is None:
        return {
            "status": "ok",
            "letter": None,
            "message": "No verified overcharges found -- no dispute letter generated."
        }

    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )

    return {
        "status": "ok",
        "letter": message.content[0].text
    }


@app.function()
@modal.fastapi_endpoint()
def health():
    return {"status": "ok", "message": "BillGuard Modal alive"}


@app.function(secrets=[modal.Secret.from_name("neon-db")])
@modal.fastapi_endpoint(method="POST")
async def analyze(bill: UploadFile = File(...)):
    contents = await bill.read()

    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")

    is_pdf = (
        (bill.content_type == "application/pdf")
        or (bill.filename and bill.filename.lower().endswith(".pdf"))
    )

    if is_pdf:
        from pdf2image import convert_from_bytes
        pages = convert_from_bytes(contents)
        if len(pages) > MAX_PDF_PAGES:
            raise HTTPException(status_code=400, detail=f"PDF has too many pages. Maximum is {MAX_PDF_PAGES}.")
        text_parts = []
        for i, page_img in enumerate(pages):
            page_text = pytesseract.image_to_string(page_img)
            text_parts.append(f"--- Page {i + 1} ---\n{page_text}")
        text = "\n".join(text_parts)
    else:
        image_data = BytesIO(contents)
        img = Image.open(image_data)
        text = pytesseract.image_to_string(img)

    line_items = extract_line_items(text)
    enriched_items = await asyncio.to_thread(enrich_with_fee_schedule, line_items)

    return {
        "status": "ok",
        "text": text,
        "line_items": enriched_items,
        "line_items_found": len(enriched_items)
    }
