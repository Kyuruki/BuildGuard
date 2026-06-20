import csv
import os
import psycopg2
from collections import defaultdict
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]

CSV_FILE = "PUF_CLFS_CY2026_Q2V1.csv"

rates_by_code = defaultdict(list)
total_lines = 0
skipped = 0

print("=== Sample raw rows (first 3) ===")
with open(CSV_FILE, "r", encoding="utf-8-sig") as f:
    reader = csv.reader(f)
    for i, row in enumerate(reader):
        if i < 3:
            print(f"Row {i}: {row}")
        else:
            break

print("\n=== Parsing CLFS data ===")
with open(CSV_FILE, "r", encoding="utf-8-sig") as f:
    reader = csv.reader(f)
    for row in reader:
        total_lines += 1

        if len(row) < 6:
            skipped += 1
            continue

        hcpcs = row[1].strip()
        payment_rate_raw = row[5].strip()

        try:
            payment_rate = float(payment_rate_raw)
        except ValueError:
            skipped += 1
            continue

        # Skip obviously invalid/header rows (HCPCS codes should be 5 chars)
        if len(hcpcs) != 5:
            skipped += 1
            continue

        rates_by_code[hcpcs].append(payment_rate)

print(f"Total lines read: {total_lines}")
print(f"Skipped: {skipped}")
print(f"Unique HCPCS codes: {len(rates_by_code)}")

if len(rates_by_code) == 0:
    print("\nNo valid rows parsed. Stopping before touching the database.")
    exit(1)

rows_to_insert = [
    (code, round(sum(rates) / len(rates), 2))
    for code, rates in rates_by_code.items()
]

print("\n=== Connecting to Neon ===")
conn = psycopg2.connect(DATABASE_URL, connect_timeout=15)
cur = conn.cursor()

print("Creating clfs_fee_schedule table if it doesn't exist...")
cur.execute("""
    CREATE TABLE IF NOT EXISTS clfs_fee_schedule (
        hcpcs_code VARCHAR(10) PRIMARY KEY,
        payment_rate DECIMAL(10,2)
    )
""")

print("Truncating clfs_fee_schedule...")
cur.execute("TRUNCATE TABLE clfs_fee_schedule")

print(f"Inserting {len(rows_to_insert)} rows...")
execute_values(
    cur,
    "INSERT INTO clfs_fee_schedule (hcpcs_code, payment_rate) VALUES %s",
    rows_to_insert,
    page_size=1000
)

conn.commit()
cur.close()
conn.close()
print(f"\nDone. Loaded {len(rows_to_insert)} HCPCS codes into clfs_fee_schedule.")