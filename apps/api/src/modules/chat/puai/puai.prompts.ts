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

// Research: tổng hợp nhiều nguồn thành báo cáo ngắn (tốn 2 lượt)
export const RESEARCH_PROMPT = `
Chế độ RESEARCH: đọc kỹ mọi nguồn trong <context>, tổng hợp thành báo cáo ngắn có cấu trúc:
## Tóm tắt (2–3 câu trả lời thẳng câu hỏi)
## Phân tích (theo từng ý, so sánh các nguồn; nêu rõ khi nguồn mâu thuẫn hoặc thiếu)
## Nguồn đã dùng (gạch đầu dòng tên nguồn trong <context>)
## Cần kiểm chứng thêm
Không bịa nguồn ngoài <context>; phần nào dựa trên hiểu biết chung thì nói rõ.`

// Skill người dùng tự tạo: chỉ dẫn bổ sung, không được vượt quy tắc ở trên
export const skillPrompt = (name: string, instructions: string) => `

Người dùng gọi skill "${name}" do chính họ định nghĩa. Làm theo chỉ dẫn trong <skill> về nội dung và cách trình bày, trừ khi trái với các quy tắc ở trên:
<skill>
${instructions}
</skill>`

// Tóm tắt phần đầu cuộc trò chuyện (không còn trong lịch sử gửi kèm)
export const summaryPrompt = (summary: string) => `

Tóm tắt phần trước của cuộc trò chuyện này (dữ liệu, dùng để giữ mạch):
<memory>
${summary}
</memory>`

// Bộ nhớ dài hạn về người học (dữ liệu, không phải chỉ dẫn)
export const profilePrompt = (facts: string[]) => `

Những điều đã biết về người học (dùng để cá nhân hóa, không cần nhắc lại):
<user_profile>
${facts.map((f) => `- ${f}`).join('\n')}
</user_profile>`
