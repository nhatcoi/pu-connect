#!/usr/bin/env python3
"""Tạo tệp PDF từ JSON {title, subtitle?, sections[]}.
Dùng cho tool puc__create_pdf_report (N7AI). ReportLab vẽ chữ trực tiếp vào
luồng PDF (không qua font hệ điều hành của người xem) nên PHẢI nhúng font
có đủ glyph tiếng Việt — dùng DejaVu Serif đóng kèm repo (scripts/fonts/),
không phụ thuộc font cài sẵn trên máy chạy.
"""

import sys
import json
import os

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    ListFlowable,
    ListItem,
    Table,
    TableStyle,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

NAVY = colors.HexColor("#223771")
MUTED = colors.HexColor("#595959")
ROW_ALT = colors.HexColor("#F5F7FB")
GRID = colors.HexColor("#DDDDDD")


def esc(s) -> str:
    # Paragraph đọc một mini-XML; thoát ký tự để nội dung model sinh ra không phá cú pháp
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def register_fonts(font_dir: str) -> None:
    pdfmetrics.registerFont(TTFont("Body", os.path.join(font_dir, "DejaVuSerif.ttf")))
    pdfmetrics.registerFont(TTFont("Body-Bold", os.path.join(font_dir, "DejaVuSerif-Bold.ttf")))


def build_styles():
    return {
        "title": ParagraphStyle("title", fontName="Body-Bold", fontSize=20, textColor=NAVY, alignment=TA_CENTER, spaceAfter=6),
        "subtitle": ParagraphStyle("subtitle", fontName="Body", fontSize=11, textColor=MUTED, alignment=TA_CENTER, spaceAfter=18),
        "h1": ParagraphStyle("h1", fontName="Body-Bold", fontSize=15, textColor=NAVY, spaceBefore=14, spaceAfter=6),
        "h2": ParagraphStyle("h2", fontName="Body-Bold", fontSize=12.5, textColor=NAVY, spaceBefore=10, spaceAfter=4),
        "body": ParagraphStyle("body", fontName="Body", fontSize=11, leading=16, spaceAfter=8),
        "bullet": ParagraphStyle("bullet", fontName="Body", fontSize=11, leading=15),
        "th": ParagraphStyle("th", fontName="Body-Bold", fontSize=10, textColor=colors.white),
        "td": ParagraphStyle("td", fontName="Body", fontSize=10),
    }


def main():
    out_path, json_path, font_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    register_fonts(font_dir)
    styles = build_styles()

    story = [Paragraph(esc(data["title"]), styles["title"])]
    if data.get("subtitle"):
        story.append(Paragraph(esc(data["subtitle"]), styles["subtitle"]))

    for section in data.get("sections", []):
        heading = section.get("heading")
        if heading:
            level = section.get("level", 1)
            story.append(Paragraph(esc(heading), styles["h1"] if level == 1 else styles["h2"]))

        for para in section.get("paragraphs") or []:
            story.append(Paragraph(esc(para), styles["body"]))

        bullets = section.get("bullets") or []
        if bullets:
            items = [ListItem(Paragraph(esc(b), styles["bullet"])) for b in bullets]
            story.append(ListFlowable(items, bulletType="bullet", start="circle", leftIndent=14))
            story.append(Spacer(1, 8))

        table = section.get("table") or {}
        headers = table.get("headers") or []
        if headers:
            rows = table.get("rows") or []
            header_row = [Paragraph(esc(h), styles["th"]) for h in headers]
            body_rows = [[Paragraph(esc(c), styles["td"]) for c in row] for row in rows]
            t = Table([header_row] + body_rows, hAlign="LEFT")
            t.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                        ("GRID", (0, 0), (-1, -1), 0.5, GRID),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ]
                )
            )
            story.append(t)
            story.append(Spacer(1, 10))

    doc = SimpleDocTemplate(
        out_path,
        pagesize=A4,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        title=data.get("title", "PU Connect"),
    )
    doc.build(story)


if __name__ == "__main__":
    main()
