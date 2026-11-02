# Chế độ học

## Mục đích

Chế độ học đổi cách N7AI suy nghĩ và trình bày: cùng một câu hỏi, giải thích khác với giải bài từng bước hay lập kế hoạch ôn. Mỗi chế độ có chỉ dẫn hệ thống, công cụ và chính sách kết thúc riêng (capability).

## Các chế độ

| Chế độ | Mã | Kết quả |
|---|---|---|
| Hỏi đáp | `ask` | Trả lời trực tiếp, gọn |
| Giải thích | `explain` | Giải thích khái niệm theo cấp độ, có ví dụ |
| Giải bài | `solve` | Lập kế hoạch, giải từng bước, hoàn thành từng bước, lập lại kế hoạch khi cần |
| Trắc nghiệm | `quiz` | Lập kế hoạch bộ câu hỏi, soạn, tự kiểm chất lượng rồi lưu thành bộ quiz |
| Flashcard | `flashcards` | Tạo bộ thẻ, hỗ trợ mẫu từ vựng có phiên âm và ví dụ |
| Tóm tắt | `summarize` | Tóm tắt tài liệu hoặc hội thoại |
| Kế hoạch | `plan` | Kế hoạch học theo mục tiêu và thời gian |
| Hỏi lại | `ask_questions` | N7AI hỏi người dùng để làm rõ trước khi làm |
| Nghiên cứu | `research` | Truy xuất sâu hơn (nhiều bài và tài liệu hơn) và báo cáo có trích dẫn; tốn 2 lượt |

Giao diện còn khai báo các mã `deep_solve`, `deep_question`, `deep_research`, `visualize`, `video_lesson`, `audio_overview`, `math_animator`; các mã này dành cho các khả năng mở rộng và chưa có trong luồng dùng chính.

## Cách chọn

- Thanh chip dưới màn chào: Explain, Solve, Practice, Plan, Research.
- Khay Mode trong ô soạn, hoặc gõ `/` rồi tên chế độ.
- Ở chế độ Hỏi đáp, N7AI tự chọn công cụ phù hợp, kể cả tạo flashcard hoặc quiz khi người dùng yêu cầu.

## Tạo bộ học trong chat

1. N7AI gọi công cụ `my_study__create_flashcards` hoặc `my_study__create_quiz` (chỉ có trong thread riêng).
2. Máy chủ kiểm từng mục, lưu phần hợp lệ (`source = 'n7ai'`), trả lại phần bị bỏ để mô hình sửa.
3. Cuối tin chèn khối tương tác; người dùng ôn ngay trong chat, trong Thư viện, hoặc ở Công cụ học tập.
4. Một tin chỉ tạo một bộ. Tối đa 60 thẻ mỗi lần; khi chỉ nêu chủ đề, mặc định 8 đến 12 thẻ.

Chi tiết lịch ôn và dữ liệu xem [Công cụ học tập](../web/study-tools).

## Hỏi lại người dùng

Công cụ `ask_user` tạm dừng lượt, hiện thẻ lựa chọn. Bấm một lựa chọn sẽ gửi đáp án thành tin kế tiếp và N7AI tiếp tục. Dùng khi nhánh học phụ thuộc vào lựa chọn của người dùng.

## Hạn mức

Mỗi chế độ tính hạn mức: thường 1 lượt; Nghiên cứu tối thiểu 2 lượt; mức model Sâu cũng tính 2 lượt (xem [Mức model và hạn mức](models-quota)).
