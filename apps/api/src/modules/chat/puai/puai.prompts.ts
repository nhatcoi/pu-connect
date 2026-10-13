import type { AiMode } from '@pu/schemas'

// Trong nhóm chat: nhiều người, PU AI chỉ trả lời khi được @puai
export const GROUP_PROMPT = `
Bạn đang ở trong một nhóm chat học tập; tin nhắn có dạng "Tên: nội dung". Trả lời người vừa gọi @puai, ngắn gọn hơn bình thường, có thể nhắc tên họ.`

// Chỉ dẫn thêm cho từng chế độ học (gắn vào system prompt của lượt đó)
export const MODE_PROMPTS: Record<AiMode, string> = {
  ask: '',
  explain: `
Chế độ GIẢI THÍCH: giải thích khái niệm từ trực giác → định nghĩa chính xác → ví dụ cụ thể (có số liệu/code nếu hợp) → lỗi hay gặp. Chia bước rõ ràng. Kết thúc bằng 1 câu hỏi ngắn để người học tự kiểm tra hiểu bài.`,
  quiz: `
Chế độ QUIZ: tạo 5 câu trắc nghiệm (4 lựa chọn, 1 đáp án đúng) về chủ đề người dùng nêu, độ khó tăng dần.
Viết 1 câu giới thiệu ngắn, rồi trả về DUY NHẤT một khối code ngôn ngữ \`quiz\` chứa JSON hợp lệ theo mẫu:
\`\`\`quiz
{"title": "Tên chủ đề", "questions": [{"q": "Câu hỏi?", "options": ["A", "B", "C", "D"], "answer": 0, "explain": "Vì sao đáp án đúng"}]}
\`\`\`
"answer" là chỉ số (0-3) của lựa chọn đúng. Không viết đáp án ngoài khối JSON.`,
  flashcards: `
Chế độ FLASHCARD: tạo 8–12 thẻ ghi nhớ (thuật ngữ/công thức/khái niệm cốt lõi) cho chủ đề người dùng nêu.
Viết 1 câu giới thiệu ngắn, rồi trả về DUY NHẤT một khối code ngôn ngữ \`flashcards\` chứa JSON hợp lệ theo mẫu:
\`\`\`flashcards
{"title": "Tên chủ đề", "cards": [{"front": "Mặt trước (câu hỏi/thuật ngữ)", "back": "Mặt sau (giải thích ngắn)"}]}
\`\`\``,
  summarize: `
Chế độ TÓM TẮT: tóm tắt nội dung người dùng gửi (văn bản, ảnh chụp, tệp) hoặc nguồn trong <context>. Cấu trúc:
## Ý chính (3–6 gạch đầu dòng)
## Thuật ngữ / công thức quan trọng
## Câu hỏi ôn tập (3 câu)
Nếu không có nội dung để tóm tắt, hãy đề nghị người dùng dán văn bản hoặc gửi ảnh/tệp.`,
  plan: `
Chế độ LỘ TRÌNH ÔN TẬP: lập kế hoạch ôn tập theo số ngày/giờ người dùng nêu (nếu thiếu, giả định 7 ngày, 2 giờ/ngày và nói rõ giả định).
Trình bày bằng bảng Markdown (Ngày | Nội dung | Hoạt động | Kết quả cần đạt), ưu tiên phần trọng tâm trước, chừa 1 buổi làm đề tổng hợp. Kết thúc bằng 3 mẹo ôn tập ngắn.`
}
