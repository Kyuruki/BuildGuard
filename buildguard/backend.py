import modal
from fastapi import File, UploadFile
from io import BytesIO
from PIL import Image
import pytesseract

from fastapi import FastAPI, File, UploadFile
image = modal.Image.debian_slim().pip_install("fastapi[standard]").pip_install("pytesseract", "Pillow").apt_install("tesseract-ocr")

app = modal.App("billguard", image=image)

@app.function()
@modal.fastapi_endpoint()
def health():
    return {"status": "ok", "message": "BillGuard Modal alive"}

@app.function()
@modal.fastapi_endpoint(method="POST")
async def analyze(bill: UploadFile = File(...)):
    contents = await bill.read() 
    image_data = BytesIO(contents)
    img = Image.open(image_data)
    text = pytesseract.image_to_string(img)
    return {"status": "Ok", "text": text}