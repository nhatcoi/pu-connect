#!/usr/bin/env python3
"""Tạo tệp Word (.docx) từ JSON {title, subtitle?, sections[]}.
Dùng cho tool puc__create_document (N7AI). Nội dung tiếng Việt: font chuẩn
hỗ trợ sẵn Unicode Latin (Times New Roman), không cần nhúng font riêng
(khác PDF rasterize phía server).
"""

import sys
import json

from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

NAVY = RGBColor(0x22, 0x37, 0x71)
FONT = "Times New Roman"


def set_run(run, size=12, bold=False, color=None):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    if color is not None:
        run.font.color.rgb = color


def main():
    out_path, json_path = sys.argv[1], sys.argv[2]
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    doc = Document()
    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(12)

    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_run(title_p.add_run(data["title"]), size=20, bold=True, color=NAVY)

    if data.get("subtitle"):
        sub_p = doc.add_paragraph()
        sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        set_run(sub_p.add_run(data["subtitle"]), size=12)

    for section in data.get("sections", []):
        heading = section.get("heading")
        if heading:
            level = section.get("level", 1)
            hp = doc.add_paragraph()
            hp.paragraph_format.space_before = Pt(14)
            hp.paragraph_format.space_after = Pt(6)
            set_run(hp.add_run(heading), size=16 if level == 1 else 13, bold=True, color=NAVY)

        for para in section.get("paragraphs") or []:
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(8)
            set_run(p.add_run(str(para)), size=12)

        for bullet in section.get("bullets") or []:
            bp = doc.add_paragraph(style="List Bullet")
            set_run(bp.add_run(str(bullet)), size=12)

        table = section.get("table")
        headers = (table or {}).get("headers") or []
        if table and headers:
            rows = table.get("rows") or []
            t = doc.add_table(rows=1, cols=len(headers))
            try:
                t.style = "Light Grid Accent 1"
            except KeyError:
                pass
            for i, h in enumerate(headers):
                cell = t.rows[0].cells[i]
                cell.text = ""
                set_run(cell.paragraphs[0].add_run(str(h)), size=11, bold=True)
            for row in rows:
                cells = t.add_row().cells
                for i in range(len(headers)):
                    val = row[i] if i < len(row) else ""
                    cells[i].text = ""
                    set_run(cells[i].paragraphs[0].add_run(str(val)), size=11)

    doc.save(out_path)


if __name__ == "__main__":
    main()
