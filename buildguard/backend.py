import modal

image = modal.Image.debian_slim().pip_install("fastapi[standard]")

app = modal.App("billguard", image=image)

@app.function()
@modal.fastapi_endpoint()
def health():
    return {"status": "ok", "message": "BillGuard Modal alive"}