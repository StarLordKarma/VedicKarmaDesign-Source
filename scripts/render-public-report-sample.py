"""Run after build-public-report-sample.mts. Requires pypdf, reportlab, Pillow and pdftoppm.

Uses only fictional data and produces exactly three public pages, never the full report.
Set FONTCONFIG_FILE to the local font configuration if required by Poppler.
"""
from pathlib import Path
import subprocess

from PIL import Image
from pypdf import PdfReader, PdfWriter

reader = PdfReader("tmp/pdfs/public-sample-source.pdf")
writer = PdfWriter()
output = Path("client/public/samples")
output.mkdir(parents=True, exist_ok=True)
period_index = next(i for i, page in enumerate(reader.pages) if "Your timeline" in page.extract_text())
for index in [0, 1, period_index]:
    page = reader.pages[index]
    assert "FICTIONAL SAMPLE" in page.extract_text()
    writer.add_page(page)
writer.add_metadata({"/Title": "Vedic reading sample - Elena Marin (fictional)", "/Subject": "Three selected pages. Fictional identity and birth details; illustrative interpretation."})
pdf = output / "vedic-reading-sample.pdf"
writer.write(pdf)
subprocess.run(["pdftoppm", "-scale-to", "1600", "-png", str(pdf), "tmp/pdfs/public-sample"], check=True)
for index in range(1, 4):
    image = Image.open(f"tmp/pdfs/public-sample-{index}.png").convert("RGB")
    image.save(output / f"reading-page-{index}.webp", "WEBP", quality=88, method=6)
assert len(PdfReader(pdf).pages) == 3
print("Published three fictional sample pages and WebP previews.")
