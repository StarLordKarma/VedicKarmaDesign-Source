"""Run after build-public-report-sample.mts. Requires pypdf, reportlab, Pillow and pdftoppm.

Uses only fictional data and produces exactly three public pages, never the full report.
Set FONTCONFIG_FILE to the local font configuration if required by Poppler.
"""
from io import BytesIO
from pathlib import Path
import subprocess

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

reader = PdfReader("tmp/pdfs/public-sample-source.pdf")
writer = PdfWriter()
output = Path("client/public/samples")
output.mkdir(parents=True, exist_ok=True)
for index in [0, 1, len(reader.pages) - 1]:
    page = reader.pages[index]
    overlay = BytesIO()
    c = canvas.Canvas(overlay, pagesize=(float(page.mediabox.width), float(page.mediabox.height)))
    c.setFillColorRGB(.60, .31, .20)
    c.setFont("Helvetica", 7)
    c.drawString(72, float(page.mediabox.height) - 101, "FICTIONAL SAMPLE  /  ELENA MARIN  /  NOT A PERSONAL READING")
    if index == 0:
        c.setFont("Helvetica", 8)
        c.setFillColorRGB(.45, .41, .36)
        c.drawString(72, float(page.mediabox.height) - 296, "Invented birth details: 1 January 2000, 12:00, Berlin, Germany")
    c.save()
    overlay.seek(0)
    page.merge_page(PdfReader(overlay).pages[0])
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
