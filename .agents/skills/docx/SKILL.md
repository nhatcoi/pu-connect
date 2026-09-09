---
name: docx
description: Convert, style, manipulate, and generate Microsoft Word (.docx) documents from Markdown and other formats using Pandoc and Word styling templates. Use whenever asked to convert, format, or produce docx files or reports.
---

# Skill: Word (.docx) Document Generation & Conversion

Kỹ năng này hướng dẫn quy trình chuyển đổi, định dạng và xuất bản tài liệu Microsoft Word (`.docx`) từ tài liệu Markdown (`.md`), HTML hoặc văn bản thô, hỗ trợ bảng biểu, công thức toán học LaTeX, khối mã nguồn (code blocks) và áp dụng template mẫu của trường/tổ chức.

---

## 1. Công Cụ & Môi Trường

Hệ thống sử dụng **Pandoc** (CLI đa năng đã có sẵn trên máy):
```bash
pandoc --version
```

---

## 2. Quy Trình Chuyển Đổi Markdown sang DOCX

### 2.1. Chuyển đổi cơ bản (Standard Conversion)
Chuyển đổi trực tiếp một file Markdown sang Word:
```bash
pandoc input.md -o output.docx
```

### 2.2. Áp dụng Mẫu Định Dạng Chuẩn (Reference Template)
Để văn bản đầu ra kế thừa font chữ (Times New Roman / Arial), kích thước tiêu đề, căn lề lề trang, màu sắc và kiểu bảng từ mẫu Word sẵn có:
```bash
pandoc input.md --reference-doc="path/to/template.docx" -o output.docx
```

*Ví dụ với đồ án Phenikaa:*
```bash
pandoc "docs/report/_Proposal Hướng dẫn/PROPOSAL.md" \
  --reference-doc="docs/report/Templates/CSE703014_Project_Proposal_Template_VI_V1.docx" \
  -o "docs/report/_Proposal Hướng dẫn/PROPOSAL.docx"
```

### 2.3. Chuyển đổi kèm Mục Lục Tự Động (TOC) & Số Thứ Tự Tiêu Đề
```bash
pandoc input.md \
  --toc \
  --toc-depth=3 \
  --number-sections \
  --reference-doc="path/to/template.docx" \
  -o output.docx
```

---

## 3. Quy Chuẩn Định Dạng Markdown Cho DOCX Đẹp

1. **Bảng biểu (Tables):**
   * Sử dụng định dạng bảng GFM (GitHub Flavored Markdown).
   * Luôn có dòng phân cách `|---|---|` rõ ràng để Pandoc tự động tính toán độ rộng cột trong Word.
2. **Công thức Toán học (LaTeX Math):**
   * Sử dụng `$inline_math$` cho công thức trên dòng.
   * Sử dụng `$$block_math$$` cho công thức khối căn giữa. Pandoc tự động chuyển đổi sang định dạng **Office Math (OMML)** chuẩn Word.
3. **Sơ đồ Mermaid / Khối mã (Code Blocks):**
   * Trong file docx, các khối mã nguồn (```` ```sql ````, ```` ```typescript ````) sẽ được đóng khung và giữ nguyên font Monospace.
   * Với sơ đồ Mermaid, có thể giữ code block hoặc nhúng ảnh PNG xuất ra từ mermaid-cli để hiển thị trực quan trong Word.

---

## 4. Kiểm Tra & Xác Nhận File DOCX

Sau khi xuất file, kiểm tra tính toàn vẹn và dung lượng file:
```bash
ls -lh output.docx
file output.docx
```
Kết quả hiển thị `Microsoft Word 2007+` xác nhận file hoàn toàn hợp lệ và có thể mở trực tiếp bằng Microsoft Word, Google Docs, Apple Pages hoặc LibreOffice.
