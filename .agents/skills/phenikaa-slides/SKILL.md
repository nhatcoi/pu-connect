---
name: "phenikaa-slides"
description: "Tạo slide PowerPoint (.pptx) theo mẫu Đại học Phenikaa (bìa xanh navy có logo, nền lục giác, thanh cam). Dùng khi người dùng muốn slide/thuyết trình/NCKH kiểu Phenikaa."
---

# Slide theo mẫu Phenikaa

Tạo bộ slide .pptx dùng ĐÚNG master/layout của file mẫu `PHENIKAA-Presentation-Template-final.pptx`. Logo, nền lục giác, thanh cam–navy và URL chân trang đã nằm sẵn trong layout, nên KHÔNG tự vẽ lại và KHÔNG tạo deck từ đầu bằng pptxgenjs.

## Điều kiện bắt buộc
- Cần file mẫu .pptx của Phenikaa. Tìm file này trong thư mục upload của phiên làm việc. Nếu không có, yêu cầu người dùng đính kèm lại, vì skill chỉ lưu hướng dẫn chứ không lưu file mẫu.
- Đọc thêm skill `pptx` (validate, render ảnh kiểm tra) trước khi dựng.
- Cần `python-pptx` (`pip install python-pptx --break-system-packages` nếu thiếu).

## Nhận diện thương hiệu (đo từ file mẫu)
- Khổ 16:9 (12192000 x 6858000 EMU). Màu chủ đạo navy `223771`, nhấn cam `F26522`, nền trắng; ô nhạt `EEF1F8`; chữ `1F1F1F`.
- Font nội dung: Times New Roman. Tiêu đề trong layout: navy, đậm, ~30–33pt, nằm trên-trái; logo Phenikaa ở trên-phải (có sẵn trong layout).
- Layout trong mẫu: `Title Slide` (bìa navy + logo, dùng cho bìa và slide cảm ơn), `Title and Content` (nội dung chính: chỉ có placeholder tiêu đề, nội dung là textbox tự thêm), `Section Header` (slide chương), `Title Only`, `Two Content`, `1_Title Slide` (tiêu đề bên phải + placeholder hình bên trái), `Blank`.
- Vùng nội dung an toàn (EMU): x 560000–11630000, y 1050000–6150000. Phía dưới y≈6.2M là thanh cam/navy, không đặt chữ đè lên. Hoa văn lục giác xám ở góc phải-dưới, nên ưu tiên chữ lệch trái.

## Quy trình
1. Hỏi/suy ra: chủ đề, đối tượng (hội đồng NCKH, bài giảng, báo cáo môn học), số slide, tên nhóm/giảng viên/khoa để ghi ở bìa. Nếu người dùng đã đưa nội dung thì dựng luôn, không hỏi thêm.
2. Lên dàn ý: mỗi slide một ý chính, bullet ngắn (tối đa ~5 dòng, mỗi dòng 1–2 câu), thuyết trình trực tiếp khoảng 1.5–2 phút/slide. Cấu trúc thường dùng: Bìa → Mục lục/Đặt vấn đề → Các phần (có slide chương nếu deck dài) → Kết quả/Kết luận → Cảm ơn.
3. Ghi file helper bên dưới ra `phenikaa_deck.py` (thư mục riêng, không phải thư mục chứa file mẫu), viết script gọi `Deck`, chạy.
4. Chọn dạng slide cho hợp nội dung và đổi dạng liên tục, tránh toàn bullet: `bullets`, `two_col` (so sánh), `stats` (số liệu lớn), `table`, `image` (hình/biểu đồ), `section` (chương).
5. Biểu đồ: dựng ảnh bằng matplotlib (màu navy/cam), rồi dùng `image`; hoặc bảng khi số liệu ít.
6. QA bắt buộc: `validate.py out.pptx --original <mẫu>`; render PDF → ảnh và xem từng slide: chữ tràn khung, đè thanh đáy/logo, tiêu đề quá dài (tiêu đề tối đa ~45 ký tự để không đụng logo bên phải; nếu dài hãy rút gọn). Sau đó `markitdown out.pptx` kiểm tra lỗi chính tả tiếng Việt và còn sót chữ mẫu không.
7. Gửi file .pptx cho người dùng kèm một dòng mô tả.

## Quy tắc thiết kế
- Tiêu đề không kết thúc bằng dấu chấm. Giữ cùng vị trí/cỡ tiêu đề ở mọi slide nội dung (đã do layout đảm bảo, không tự dời).
- Cỡ chữ: nội dung ≥18pt (bullet 24pt, bảng 18pt), chú thích ≥14pt. Không thu nhỏ để nhồi chữ; hãy tách slide.
- Chỉ dùng navy làm màu chính, cam chỉ để nhấn (số liệu, từ khóa). Không thêm dải màu, đường kẻ dưới tiêu đề hay logo thứ hai.
- Không dùng `#` hoặc alpha trong mã màu; dùng `RGBColor`.
- Bìa: tiêu đề đề tài IN HOA, dòng phụ là nhóm/khoa/giảng viên/ngày. Slide cuối dùng `closing`.
- Thuyết minh (speaker notes) nếu người dùng cần thì `d.notes(slide, "...")`.
- Nếu người dùng yêu cầu layout mẫu khác (ví dụ slide bìa phụ như slide 2–3 của mẫu), có thể lấy layout `Title and Content` rồi đặt tiêu đề lớn giữa slide, nhưng ưu tiên các dạng trong helper.

## Helper `phenikaa_deck.py`

```python
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

NAVY, ORANGE = RGBColor(0x22,0x37,0x71), RGBColor(0xF2,0x65,0x22)
INK, MUTED, WHITE = RGBColor(0x1F,0x1F,0x1F), RGBColor(0x59,0x59,0x59), RGBColor(255,255,255)
FONT = "Times New Roman"
X0, X1, Y0, Y1 = 560000, 11630000, 1050000, 6150000

class Deck:
    def __init__(self, template):
        self.p = Presentation(template)
        ids = self.p.slides._sldIdLst           # xóa slide mẫu, giữ layout/master
        for s in list(ids):
            self.p.part.drop_rel(s.rId); ids.remove(s)
        self.L = {l.name: l for l in self.p.slide_layouts}

    def _slide(self, layout, title=None):
        s = self.p.slides.add_slide(self.L[layout])
        if title is not None and s.shapes.title is not None:
            s.shapes.title.text = title
        return s

    def _text(self, s, x, y, w, h, paras, size=20, color=INK, bold=False,
              align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, bullet=False, italic=False):
        tb = s.shapes.add_textbox(Emu(x), Emu(y), Emu(w), Emu(h))
        tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = anchor
        paras = [paras] if isinstance(paras, str) else paras
        for i, t in enumerate(paras):
            para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            para.alignment = align; para.space_after = Pt(8)
            r = para.add_run(); r.text = ("•  " + t) if bullet else t
            f = r.font; f.name = FONT; f.size = Pt(size); f.bold = bold
            f.italic = italic; f.color.rgb = color
        return tb

    def _centered_sub(self, s, text):
        if len(s.placeholders) > 1:
            sub = s.placeholders[1]; sub.text = text
            sub.left, sub.top, sub.width, sub.height = Emu(493486), Emu(4750000), Emu(11219542), Emu(900000)
            for para in sub.text_frame.paragraphs:
                para.alignment = PP_ALIGN.CENTER
                for r in para.runs: r.font.name, r.font.size, r.font.color.rgb = FONT, Pt(20), WHITE

    def _big_title(self, s, text):
        t = s.shapes.title; t.text = text
        t.left, t.top, t.width, t.height = Emu(493486), Emu(3782987), Emu(11219542), Emu(906811)
        for r in t.text_frame.paragraphs[0].runs: r.font.name, r.font.size = FONT, Pt(36)

    def cover(self, title, subtitle=""):
        s = self._slide("Title Slide"); self._big_title(s, title); self._centered_sub(s, subtitle); return s

    def closing(self, text="Xin cảm ơn!", sub=""):
        s = self._slide("Title Slide"); self._big_title(s, text); self._centered_sub(s, sub); return s

    def section(self, title, kicker="CHỦ ĐỀ"):
        s = self._slide("Section Header", title)
        for r in s.shapes.title.text_frame.paragraphs[0].runs:
            r.font.name, r.font.size, r.font.bold, r.font.color.rgb = FONT, Pt(44), True, NAVY
        for ph in s.placeholders:
            if ph.placeholder_format.idx == 1: ph.text = kicker
        return s

    def bullets(self, title, items, size=24):
        s = self._slide("Title and Content", title)
        self._text(s, X0, Y0, 8300000, Y1-Y0, items, size=size, bullet=True)
        return s

    def two_col(self, title, left_head, left, right_head, right, size=20):
        s = self._slide("Title and Content", title)
        w = (X1-X0-400000)//2
        for i, (h, items) in enumerate([(left_head, left), (right_head, right)]):
            x = X0 + i*(w+400000)
            box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Emu(x), Emu(Y0), Emu(w), Emu(520000))
            box.fill.solid(); box.fill.fore_color.rgb = NAVY; box.line.fill.background()
            tf = box.text_frame; tf.paragraphs[0].alignment = PP_ALIGN.CENTER
            r = tf.paragraphs[0].add_run(); r.text = h
            r.font.name, r.font.size, r.font.bold, r.font.color.rgb = FONT, Pt(22), True, WHITE
            self._text(s, x, Y0+620000, w, Y1-Y0-620000, items, size=size, bullet=True)
        return s

    def stats(self, title, stats):
        """stats: [(số lớn, nhãn), ...] tối đa 4"""
        s = self._slide("Title and Content", title)
        n = len(stats); gap = 300000; w = (X1-X0-gap*(n-1))//n
        for i, (big, label) in enumerate(stats):
            x = X0 + i*(w+gap)
            card = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Emu(x), Emu(1700000), Emu(w), Emu(2600000))
            card.fill.solid(); card.fill.fore_color.rgb = RGBColor(0xEE,0xF1,0xF8)
            card.line.fill.background(); card.shadow.inherit = False
            self._text(s, x, 1950000, w, 1100000, big, size=48, color=ORANGE, bold=True,
                       align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
            self._text(s, x+100000, 3150000, w-200000, 1000000, label, size=18, color=NAVY,
                       align=PP_ALIGN.CENTER)
        return s

    def table(self, title, header, rows, size=18):
        s = self._slide("Title and Content", title)
        h = min(Y1-Y0, 480000*(len(rows)+1))
        gt = s.shapes.add_table(len(rows)+1, len(header), Emu(X0), Emu(Y0), Emu(X1-X0), Emu(h)).table
        for c, t in enumerate(header):
            cell = gt.cell(0, c); cell.text = t
            cell.fill.solid(); cell.fill.fore_color.rgb = NAVY
            for r in cell.text_frame.paragraphs[0].runs:
                r.font.name, r.font.size, r.font.bold, r.font.color.rgb = FONT, Pt(size), True, WHITE
        for i, row in enumerate(rows, 1):
            for c, t in enumerate(row):
                cell = gt.cell(i, c); cell.text = str(t)
                cell.fill.solid(); cell.fill.fore_color.rgb = WHITE if i % 2 else RGBColor(0xEE,0xF1,0xF8)
                for r in cell.text_frame.paragraphs[0].runs:
                    r.font.name, r.font.size, r.font.color.rgb = FONT, Pt(size), INK
        return s

    def image(self, title, path, caption="", bullets=None):
        s = self._slide("Title and Content", title)
        if bullets:
            self._text(s, X0, Y0, 4300000, Y1-Y0, bullets, size=20, bullet=True)
            s.shapes.add_picture(path, Emu(5200000), Emu(Y0), width=Emu(6400000))
        else:
            s.shapes.add_picture(path, Emu(X0), Emu(Y0), height=Emu(Y1-Y0-350000))
        if caption:
            self._text(s, X0, Y1-300000, X1-X0, 300000, caption, size=14, color=MUTED, italic=True)
        return s

    def notes(self, slide, text):
        slide.notes_slide.notes_text_frame.text = text

    def save(self, path): self.p.save(path)
```

Ví dụ dùng:

```python
from phenikaa_deck import Deck
d = Deck("/đường/dẫn/PHENIKAA-Presentation-Template-final.pptx")
d.cover("TÊN ĐỀ TÀI", "Nhóm NCKH – Khoa CNTT – GVHD: ...")
d.section("Tổng quan", "PHẦN 1")
d.bullets("Mục tiêu nghiên cứu", ["Ý 1", "Ý 2", "Ý 3"])
d.two_col("So sánh", "Phương án A", ["..."], "Phương án B", ["..."])
d.stats("Kết quả chính", [("92%", "Độ chính xác"), ("1.2s", "Thời gian phản hồi")])
d.table("Bảng đánh giá", ["Mô hình", "Precision"], [["A", "0.81"]])
d.closing("Xin cảm ơn!", "Xin mời quý thầy cô đặt câu hỏi")
d.save("out.pptx")
```

Lưu ý: nếu tiêu đề phần nội dung dài hơn ~45 ký tự, rút gọn để không chạm logo ở góc phải; `section` và `Two Content` có kích thước tiêu đề khác `Title and Content`, nên dùng helper thay vì tự chọn layout.