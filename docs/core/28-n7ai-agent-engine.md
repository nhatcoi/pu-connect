# N7AI: agent engine (vòng lặp 2 pha)

Implemented: 2026-11-02. Mã nguồn: `apps/api/src/modules/ai/engine/`. Đây là vòng agent DUY NHẤT của N7AI: thread riêng, nhóm chat / chat cá nhân (`@n7ai`) và tóm tắt bài viết. Vòng cũ (`McpAgentService`) đã gỡ.

## Vì sao đổi

Vòng cũ cấp cho mỗi vòng `max(16384 − token đã dùng, 2048)` và tính cả token suy nghĩ. Sau vài vòng tool, vòng cuối còn ~2048 token bị suy nghĩ ăn hết ⇒ `finish_reason=length` với nội dung rỗng ⇒ câu "Xin lỗi, mình không thể trả lời… (bị cắt do quá dài)". Engine mới cấp đủ ngân sách đầu ra cho MỖI vòng và có nhánh phục hồi riêng cho ca này.

## Kiến trúc

```
runReply (n7ai.service.ts)
   └─ N7AgentService.stream()
        ├─ tool session (Google MCP, PU Connect, học tập, tài liệu, bộ nhớ…) + AgentToolRunner (bước, cache, giới hạn)
        ├─ capability theo chế độ học   chỉ dẫn + công cụ riêng + chính sách kết thúc + ngân sách
        └─ N7AgentSession (LoopHost)    thực thi từng thao tác
             └─ core/run-loop           bộ lập lịch thuần, không I/O
```

| Lớp | File | Việc |
|---|---|---|
| Lập lịch | `core/run-loop.ts`, `core/contracts.ts` | Quyết định bước kế: gọi vòng, chạy tool, phục hồi, chốt |
| Phiên | `native/n7-session.ts` | Thực thi thao tác; cộng usage mọi vòng; trả `response`, `reasoning`, `askUser` |
| Vòng model | `native/model-round.ts` | Stream, bóc `<think>`, thu tool call, thử lại một lần khi luồng bị cắt, ước lượng usage khi gateway không trả |
| Ngữ cảnh | `context/conversation.ts` | Chiếu theo cửa sổ: lược kết quả tool cũ rồi bỏ **nguyên nhóm** lịch sử cũ nhất, không để tool mồ côi |
| Tool | `tools/dispatcher.ts`, `tools/ask-user.ts` | Bỏ lệnh trùng, lọc đối số `_…`, tối đa 15 lệnh / vòng, từ chối lô bị cắt, `ask_user` |
| Capability | `capabilities/` | `solve`, `quiz`, `ask_questions`, `research` |
| Prompt nền | `prompt/foundation.ts` | Giao thức vòng lặp (một agent, mặc định hành động, hỏi gộp) |

## Hành vi chống lỗi

| Tình huống | Xử lý |
|---|---|
| Hết ngân sách thăm dò (3 vòng; research 5) | Chèn chỉ dẫn chốt, `tool_choice=none`, vẫn cấp đủ `outputTokens`; model vẫn gọi tool thì lệnh không chạy (báo "đã hết lượt tra cứu") |
| Vòng tổng hợp vẫn không ra chữ | Một vòng chốt không tool (`forced_finish`) |
| Cụt giữa câu | Chèn chỉ dẫn viết tiếp, không lặp |
| Suy nghĩ ăn hết ngân sách, chưa có chữ | Chỉ dẫn "hành động ngay"; lần hai liên tiếp ⇒ báo `length` (UI hiện cảnh báo cũ) |
| Vòng rỗng | Nhắc một lần; hai lần ⇒ vòng chốt |
| Lô tool bị cắt giữa chừng | Không chạy lệnh nào, báo lỗi để model gọi lại đủ đối số |
| Gateway từ chối tool (400/422) | `McpModelError` như trước |
| Luồng SSE đứt trước khi có nội dung | Thử lại đúng một lần |

## Capability theo chế độ học

- `solve` / `deep_solve`: công cụ `solve_plan`, `solve_finish_step`, `solve_replan` (tối đa 2 lần, giữ bước đã xong); chính sách chặn kết luận khi còn bước chưa xong (một lần / lượt). Bài đơn giản không lập kế hoạch thì không bị chặn.
- `quiz` / `deep_question` (`capabilities/quiz.ts`): công cụ `quiz_plan` (tiêu đề, số câu, mức độ, chủ đề); hook `guard` từ chối `create_quiz` khi chưa có kế hoạch hoặc bộ câu chưa đạt (sai số câu, lựa chọn trùng, thiếu `explain`, câu trùng ý, đáp án dồn một vị trí hoặc luôn là lựa chọn dài nhất); sửa tối đa 3 lần rồi cho qua; hook `observe` ghi nhận quiz đã lưu; chính sách nhắc một lần nếu kết thúc mà chưa lưu quiz. `openingTool: 'quiz_plan'` ép vòng đầu của lượt phải gọi `quiz_plan` (model hay viết thẳng bài ra chữ nếu chỉ nhắc; provider trả 400/422 với `tool_choice` ép thì tự thử lại một lần ở chế độ tự chọn). `guard`/`observe`/`openingTool` là móc chung của `LoopCapability`. Test: `test/unit/n7-agent-engine.spec.ts` (mục "Capability trắc nghiệm").
- `ask_questions`: ưu tiên `ask_user` với 1–3 câu định hướng.
- `research` / `deep_research` / cờ research: ngân sách thăm dò 5 vòng và chỉ dẫn đối chiếu nguồn.

## ask_user

Model gọi `ask_user` ⇒ lượt dừng, tin trả lời lưu `meta.askUser`; nội dung tin là lời dẫn của model, nếu không có thì ghép các câu hỏi để lịch sử vẫn đọc được. Thẻ lựa chọn (`ask-user-card.tsx`) gửi đáp án thành tin kế tiếp của thread (chỉ ở câu trả lời N7AI mới nhất).

## Tin gửi thêm khi N7AI đang trả lời

Thread riêng đang có lượt chạy mà người dùng gửi thêm một tin **chỉ có chữ** (không tệp, đoạn trích, ngữ cảnh gắn kèm, skill, research, chế độ học khác `ask`) ⇒ tin được đưa vào lượt đang chạy, vòng kế tiếp đọc nó (`drainInputs`) và trả lời gộp; không mở lượt song song. Tin tới sau vòng đọc cuối của lượt thì trả lời riêng. Registry nằm trong bộ nhớ tiến trình `pu-api` (một instance); nhiều instance sẽ quay về hành vi cũ (hai lượt song song).

## Ngữ cảnh và bộ nhớ

- Bộ nhớ, hồ sơ học, tóm tắt hội thoại nạp **im lặng** vào system prompt; không còn bước "Nhớ lại điều đã biết về bạn" trên timeline. Timeline chỉ hiện tool thật.
- Khi người học bật bộ nhớ, tool `memory__search` cho model tra thêm dữ kiện cá nhân chưa có trong hồ sơ (`agent/memory-tools.service.ts`).
- Hợp nhất bộ nhớ: worker `ai-maintenance` chạy hằng ngày (`consolidate-memories`); người có hơn 30 dữ kiện tự động chưa ghim ⇒ một lượt LLM gộp trùng, bỏ lỗi thời thành ≤ 25 dòng. Mục ghim, mục tự thêm và mục của học liệu không bị đụng; kết quả hỏng / cụt / rỗng thì giữ nguyên dữ liệu (`AiMemoriesService.consolidate`).
- Tài liệu / nguồn dài hơn 24.000 ký tự: một lượt tóm lược khách quan (≤ 400 từ) chèn đầu tin hỏi trước vòng đầu (chi phí tính vào lượt).
- Suy nghĩ của model gom vào `meta.reasoning` (khối "Xem quá trình").

## Giới hạn đã biết

- ask_user bị tắt ở nhóm chat (nhiều người cùng đọc, không có "người trả lời" duy nhất).
- Tin chèn giữa lúc trả lời chỉ gộp khi chỉ có một instance `pu-api`.
- Rollback: `git revert` commit gỡ vòng cũ (không còn cờ môi trường).

Test: `test/unit/n7-agent-engine.spec.ts` (lập lịch, phiên với model giả, dispatcher, ngữ cảnh, capability, tool động, đóng tool ở pha tổng hợp, tin chèn); `test/n7ai-engine.e2e-spec.ts` (qua `runReply`: ca lỗi gốc, ask_user, tin chèn); `test/n7ai-engine-wire.e2e-spec.ts` (SDK OpenAI thật → HTTP/SSE: đối số tool xé vụn, `reasoning_content`, usage, luồng đứt thử lại); `test/n7ai-memory-consolidation.e2e-spec.ts`.
