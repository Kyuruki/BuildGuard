import csv
import os
import psycopg2
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]

rates = defaultdict(list)

total_lines = 0
skipped_short = 0
skipped_parse_error = 0
skipped_zero_or_negative = 0
parsed_ok = 0

# Print the first 3 raw rows so we can SEE the actual column layout
print("=== Sample raw rows (first 3) ===")
with open("PFALL26AR.txt", "r") as f:
    reader = csv.reader(f)
    for i, row in enumerate(reader):
        if i < 3:
            print(f"Row {i}: {row}")
        else:
            break

print("\n=== Starting full parse ===")

with open("PFALL26AR.txt", "r") as f:
    reader = csv.reader(f)
    for row in reader:
        total_lines += 1

        if total_lines % 100000 == 0:
            print(f"  ...processed {total_lines} lines | parsed_ok={parsed_ok} | skipped_short={skipped_short} | skipped_parse_error={skipped_parse_error}")

        if len(row) < 7:
            skipped_short += 1
            continue

        hcpcs = row[3].strip()

        try:
            non_facility = float(row[5].strip())
            facility = float(row[6].strip())
        except (ValueError, IndexError) as e:
            skipped_parse_error += 1
            continue

        if non_facility <= 0:
            skipped_zero_or_negative += 1
            continue

        rates[hcpcs].append((non_facility, facility))
        parsed_ok += 1

print("\n=== Parse summary ===")
print(f"Total lines read:        {total_lines}")
print(f"Skipped (too few cols):  {skipped_short}")
print(f"Skipped (parse error):   {skipped_parse_error}")
print(f"Skipped (<=0 rate):      {skipped_zero_or_negative}")
print(f"Parsed OK:                {parsed_ok}")
print(f"Unique HCPCS codes:       {len(rates)}")

if len(rates) == 0:
    print("\nNo valid rows parsed. Stopping before touching the database.")
    print("Check the sample raw rows above against the column indices (row[3], row[5], row[6]).")
    exit(1)

print("\n=== Connecting to Neon ===")
from psycopg2.extras import execute_values

conn = psycopg2.connect(DATABASE_URL, connect_timeout=15)
print("Connected.")
cur = conn.cursor()

print("Truncating fee_schedule...")
cur.execute("TRUNCATE TABLE fee_schedule")
print("Truncated.")

# Build all rows in memory first
rows_to_insert = []
for hcpcs, values in rates.items():
    avg_non_facility = sum(v[0] for v in values) / len(values)
    avg_facility = sum(v[1] for v in values) / len(values)
    rows_to_insert.append((hcpcs, round(avg_non_facility, 2), round(avg_facility, 2)))

print(f"Inserting {len(rows_to_insert)} rows in one batch...")
execute_values(
    cur,
    "INSERT INTO fee_schedule (hcpcs_code, non_facility_rate, facility_rate) VALUES %s",
    rows_to_insert,
    page_size=1000
)

conn.commit()
cur.close()
conn.close()
print(f"\nDone. Loaded {len(rates)} HCPCS codes into fee_schedule.")