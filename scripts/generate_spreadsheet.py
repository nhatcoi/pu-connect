#!/usr/bin/env python3
"""Tạo tệp Excel (.xlsx) từ JSON {title, sheets: [{name, headers?, rows}]}.
Dùng cho tool puc__create_spreadsheet (N7AI).
"""

import sys
import json

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

NAVY = "FF223771"
HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFFFF")
HEADER_FILL = PatternFill("solid", fgColor=NAVY)
HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)


def main():
    out_path, json_path = sys.argv[1], sys.argv[2]
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    wb = Workbook()
    wb.remove(wb.active)

    for sheet in data.get("sheets", []):
        name = (sheet.get("name") or "Sheet")[:31] or "Sheet"
        # Excel không cho trùng tên sheet ⇒ thêm hậu tố nếu đụng
        base, i = name, 2
        while name in wb.sheetnames:
            name = f"{base[:28]}_{i}"
            i += 1
        ws = wb.create_sheet(title=name)

        headers = sheet.get("headers") or []
        rows = sheet.get("rows") or []
        col_count = max([len(headers)] + [len(r) for r in rows] + [1])

        if headers:
            for ci, h in enumerate(headers, start=1):
                cell = ws.cell(row=1, column=ci, value=str(h))
                cell.font = HEADER_FONT
                cell.fill = HEADER_FILL
                cell.alignment = HEADER_ALIGN
            start_row = 2
        else:
            start_row = 1

        for ri, row in enumerate(rows, start=start_row):
            for ci, val in enumerate(row, start=1):
                ws.cell(row=ri, column=ci, value=val)

        for ci in range(1, col_count + 1):
            letter = get_column_letter(ci)
            max_len = len(str(headers[ci - 1])) if ci - 1 < len(headers) else 0
            for row in rows:
                if ci - 1 < len(row):
                    max_len = max(max_len, len(str(row[ci - 1])))
            ws.column_dimensions[letter].width = min(max(max_len + 2, 10), 42)

        ws.freeze_panes = "A2" if headers else "A1"

    if not wb.sheetnames:
        wb.create_sheet(title="Sheet1")

    wb.save(out_path)


if __name__ == "__main__":
    main()
