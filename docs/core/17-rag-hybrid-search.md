# 17. RAG: tìm kết hợp full-text + vector cho N7AI

> Trạng thái: ✅ Đã triển khai (2026-10-19). Code: `apps/api/src/modules/ai/rag/`. Migration: `rag-upgrade.sql`.

## 1. Vì sao

Trước đây Thư viện PU của N7AI chỉ tìm full-text (tsvector bỏ dấu, cần khớp ≥ 2 từ). Cách này hỏng ở 2 chỗ:

1. **Khác chữ / khác ngôn ngữ**: hỏi "tốc độ biến thiên tức thời" không ra tài liệu viết "đạo hàm"; hỏi tiếng Anh không ra bài tiếng Việt.
2. **Tài liệu chỉ được tìm theo tiêu đề + mô tả**: nội dung tệp PDF/DOCX không được index (`document_chunks` có sẵn trong schema nhưng không ai ghi), N7AI chỉ đọc được mô tả.

Phạm vi: **nội dung tài liệu/đề thi** (ưu tiên 1) và **bài viết hỏi đáp + lời giải đã duyệt** (ưu tiên 2). Không dùng vector cho học phần, người dùng, nhóm, cộng đồng (tìm theo tên/mã ⇒ từ khóa chính xác hơn), bộ nhớ (ít mục), `app_help`.

## 2. Kiến trúc

```
Tải tài liệu lên ─▶ documents (index_status = pending) ─┐   BullMQ "rag-index": quét 2 phút/lần + "quét ngay" khi tạo tài liệu
Bài viết mới / sửa / đổi lời giải ──────────────────────┤
                                                        ▼
                                       RagIndexService.sweep()
             (1) tải tệp từ R2 → bufferToText (PDF ≤150 trang, DOCX, text) → chunkText → document_chunks
             (2) embedding đoạn chưa có / tạo bằng model cũ  ─┐
             (3) embedding bài viết chưa có / source_hash lệch ┤──▶ EmbeddingService ──▶ VPS 127.0.0.1:11435
                                                               │                          │ reverse SSH tunnel
                                                               │                          ▼
                                                               │                  Mac mini: Ollama qwen3-embedding:0.6b
Câu hỏi N7AI ─▶ AiRetrieval ─▶ RagSearchService ──────────────┘
                 (library, my_documents)   full-text (tsvector) ∥ vector (HNSW cosine) ─▶ gộp RRF ─▶ <context>
```

| Thành phần | Tệp | Vai trò |
|---|---|---|
| `EmbeddingService` | `rag/embedding.service.ts` | Client `/v1/embeddings` OpenAI-compatible; câu hỏi có chỉ dẫn Qwen3; timeout câu hỏi 3s; lỗi ⇒ nghỉ 60s (lùi về full-text, không cộng độ trễ cho mọi câu hỏi); cache 200 câu hỏi |
| `cleanPages` / `needsOcr` | `rag/text-cleaner.ts` | Làm sạch theo trang: NFC, bỏ ký tự điều khiển / vô hình, bỏ header/footer lặp (dòng ở mép ≥ 50% số trang, ≥ 3 trang) và số trang, nối dòng bị ngắt giữa câu + gạch nối; nhận diện trang scan (< 30 ký tự) và chữ rác TCVN3/VNI (> 3% ký tự Latin-1 ngoài bảng chữ Việt) |
| `OcrService` | `rag/ocr.service.ts` | Trang scan / chữ rác ⇒ render ảnh (pdf-parse `getScreenshot`, rộng 1400px) ⇒ model vision qua chat OpenAI-compatible; ≤ `OCR_MAX_PAGES` (30) trang / tài liệu; 429 ⇒ tài liệu quay lại hàng chờ, không tính lần lỗi |
| `chunkText` | `rag/text-chunker.ts` | Gom đoạn văn tới ~1200 ký tự (tối đa 1600), đoạn quá dài tách theo câu, chồng lấn ~200 ký tự, ≤ 300 đoạn / tài liệu; nhận diện dòng tiêu đề (Chương/Phần, `1.2 …`, `Câu N`/`Lời giải Câu N`, chữ hoa, `#`) ⇒ mỗi đoạn mang đường dẫn tiêu đề (`document_chunks.heading`); mục mới khi đoạn đã ≥ 400 ký tự ⇒ mở đoạn mới (mỗi câu hỏi đứng đầu một đoạn) |
| `RagIndexService` | `rag/rag-index.service.ts` | Worker 3 bước ở trên; chỉ tải tệp thuộc R2 của mình (chặn SSRF) |
| `RagIndexProcessor` / `RagIndexQueue` | `rag/rag-index.processor.ts` | Lịch quét 2 phút; `kick()` gộp nhiều lần gọi thành 1 job chờ (`jobId: sweep-now`) |
| `RagSearchService` | `rag/rag-search.service.ts` | Tìm kết hợp bài viết / tài liệu, có `mode` (`hybrid` \| `fulltext` \| `vector`) cho eval |
| `rag-eval.cli.ts` | `rag/rag-eval.cli.ts` | Đánh giá tự động trên dữ liệu thật (mục 6) |

### Trạng thái trích nội dung tài liệu (`documents.index_status`)

`pending` → `indexing` (worker giữ, hạn 15 phút) → `indexed` | `partial` (> 150 trang, > 300 đoạn, hoặc còn trang scan chưa OCR được) | `empty` (không có chữ kể cả sau OCR) | `garbled` (chữ rác, OCR không cứu được) | `unsupported` (không phải PDF/DOCX/text hoặc URL ngoài R2) | `failed` (lỗi 3 lần). `index_version` < `INDEX_VERSION` (code) ⇒ tài liệu đã xong được làm lại bằng pipeline mới, xếp sau tài liệu mới. Lỗi lần n ⇒ thử lại sau n × 5 phút. Nhận việc bằng `FOR UPDATE SKIP LOCKED` + chuyển sang `indexing` ⇒ lịch quét và "quét ngay" chạy song song không làm trùng (lỗi race này do e2e phát hiện).

### Embedding chịu lỗi từng mục

Input embedding của đoạn = `tiêu đề tài liệu › tiêu đề mục` + nội dung; `source_hash = md5(input)` ⇒ đổi tiêu đề tài liệu cũng tính lại. Lô lỗi do kết nối / 408 / 429 / 5xx gateway ⇒ server coi như tắt 60s, thử lại lượt sau. Lô lỗi khác ⇒ thử từng mục: mục hỏng được đánh dấu `embedding_model = 'error:<model>'` (bài viết: dòng `post_embeddings` không vector) và bỏ qua tới khi nội dung đổi; mục nào cũng lỗi ⇒ lỗi ở server. Trước đây 1 input hỏng làm kẹt cả hàng đợi.

### Bước extraction không phụ thuộc server embedding

Mac mini tắt ⇒ đoạn vẫn được trích và tìm full-text ngay; cột `embedding` để NULL, lượt quét sau bù. Đổi `EMBED_MODEL` ⇒ cột `embedding_model` / `post_embeddings.model` lệch ⇒ worker tự tính lại (số chiều phải giữ 1024, khác thì sửa migration).

## 3. Tìm kết hợp (Reciprocal Rank Fusion)

Mỗi danh sách ứng viên lấy top 24, điểm = Σ trọng số / (60 + hạng):

- **Bài viết**: full-text `posts.search_tsv` ∥ vector `post_embeddings` (văn bản embedding = tiêu đề + nội dung ≤ 4000 ký tự + lời giải đã duyệt ≤ 1500).
- **Tài liệu**: full-text trên đoạn (`document_chunks.search_tsv`) ∥ full-text tiêu đề/mô tả (`documents.search_tsv`, top 10) ∥ vector trên đoạn. Gộp ở mức tài liệu, thân nguồn = mô tả + tối đa 2 đoạn có điểm gộp cao nhất của tài liệu đó (cắt theo ngân sách ký tự cũ: 1500, Research 2500).
- **Lọc nhiễu full-text bằng vector**: khi có vector câu hỏi, ứng viên full-text (bài viết, đoạn, tài liệu) phải có cosine ≥ `MIN_SIMILARITY` (0.5) mới được gộp; nguồn chưa có embedding giữ nguyên. Kết quả vector dưới ngưỡng cũng bị bỏ ⇒ câu hỏi lạc đề không kéo nguồn rác vào prompt.
- **RRF có trọng số**: danh sách full-text × `FULLTEXT_WEIGHT` = 0.5, vector × 1 (env `RAG_FULLTEXT_WEIGHT` chỉ để eval thử).
- HNSW + bộ lọc quyền xem: `SET LOCAL hnsw.iterative_scan = relaxed_order` (pgvector ≥ 0.8) ⇒ vẫn đủ kết quả khi bộ lọc loại bớt.
- Thân nguồn tài liệu: mô tả + các đoạn kèm `[tiêu đề mục]`, chia đều ngân sách ký tự cho từng đoạn. Đề thi (`midterm_exam`/`final_exam`): đoạn "Câu N" kéo theo đoạn phía bên kia (đề bài ↔ lời giải / đáp án) cùng số câu.
- Tài liệu cùng `content_hash` (sha256 tệp) chỉ trả 1 nguồn.
- Quyền xem giữ như cũ: bài viết công khai chưa ẩn (+ của mình); tài liệu công khai (+ của mình); `my_documents` chỉ tài liệu của mình.

## 4. Server embedding trên Mac mini

- Model: **`qwen3-embedding:0.6b`** (1024 chiều, đa ngôn ngữ). So trên bộ thử tiếng Việt 15 câu (khác chữ, song ngữ, có nhiễu): qwen3-0.6b 15/15, MRR 1.000, ~25ms/câu; bge-m3 14/15, MRR 0.956; qwen3-4b 15/15 nhưng chậm gấp 4 lần và 2560 chiều (vượt giới hạn 2000 chiều của HNSW `vector`).
- Gateway AI (`AI_BASE_URL`) không có `/embeddings`; VPS 2 CPU / 2GB RAM không đủ chạy model ⇒ Mac mini M4 16GB chạy Ollama, VPS gọi qua **reverse SSH tunnel**: `scripts/ops/setup-embed-tunnel.sh` cài launchd agent `dev.vnhat.pu-embed-tunnel` (`ssh -N -R 127.0.0.1:11435:127.0.0.1:11434`, KeepAlive). Cổng chỉ mở ở loopback của VPS, không lộ ra internet.
- VPS `.env`: `EMBED_BASE_URL=http://127.0.0.1:11435/v1`, `EMBED_MODEL=qwen3-embedding:0.6b`. Độ trễ một câu hỏi từ VPS ≈ 170ms.
- Mac mini ngủ / mất mạng ⇒ N7AI tự lùi về full-text (không lỗi), index bù khi tunnel lên lại. Muốn luôn sẵn sàng: tắt chế độ ngủ của Mac mini.

## 5. Dữ liệu mẫu

36 tài liệu PDF (tóm tắt bài giảng + đề ôn tập tự soạn có lời giải, ghi rõ "không phải đề thi chính thức") cho 17 học phần, do các tài khoản bot `@seed.pu-connector.test` đăng vào Thư viện PU trên prod. Nội dung sinh bằng AI gateway, render PDF bằng Edge headless, tải lên R2 `documents/<owner>/…`, worker RAG tự trích + embedding.

## 6. Đánh giá tự động (`pnpm --filter @pu/api rag:eval`)

Chạy trên VPS sau build: `node dist/apps/api/src/modules/ai/rag/rag-eval.cli.js --env /var/www/pu-connector/.env --set /root/rag-eval/set.json --out /root/rag-eval/report.md`.

1. Lần đầu sinh bộ câu hỏi từ mọi tài liệu đã index + ≤ 60 bài viết công khai: mỗi nguồn 2 câu — `paraphrase` (không dùng từ khóa của tiêu đề) và `keyword`. Lưu ra `--set` để các lần sau so sánh cùng bộ.
2. Mỗi câu hỏi chạy 3 chế độ, đo hit@1/3/5 và MRR theo loại nguồn × kiểu câu hỏi.
3. 6 câu hỏi lạc đề: đếm số nguồn trả về (càng ít càng tốt).
4. Phân vị cosine của nguồn đúng ⇒ hiệu chỉnh `MIN_SIMILARITY`.

### Kết quả trên prod (2026-10-19)

Bộ 188 câu hỏi (36 tài liệu + 58 bài viết, mỗi nguồn 2 câu; sinh bằng `gemini-3.7-flash-medium`), top-5:

| Chế độ | hit@1 | hit@3 | hit@5 | MRR | Câu lạc đề → số nguồn |
|---|---|---|---|---|---|
| Full-text (trước đây) | 47.9% | 64.4% | 68.6% | 0.563 | 52 |
| Vector thuần | 83.0% | 96.8% | 97.9% | 0.901 | 0 |
| Hybrid v1 (RRF ngang, không lọc) | 67.6% | 87.2% | 94.1% | 0.778 | 55 |
| Hybrid v2 (+ lọc full-text bằng cosine) | 78.2% | 94.7% | 96.8% | 0.861 | 0 |
| **Hybrid v3 (+ full-text × 0.5) — đang dùng** | **81.4%** | **94.7%** | **96.8%** | **0.879** | **0** |

Chi tiết hybrid v3: tài liệu hit@1 91.7% (câu có từ khóa 100%, câu diễn đạt khác 83.3%), bài viết 75.0% (từ khóa 94.8%, diễn đạt khác 55.2%). Riêng câu hỏi "diễn đạt khác" của bài viết, full-text cũ chỉ 8.6% hit@1.

Bài học:
1. **RRF ngang hàng làm hybrid tệ hơn vector thuần**: full-text "khớp ≥ 2 từ" nhiễu (6 câu lạc đề ra 52 nguồn) và đẩy kết quả đúng của vector xuống. Lọc ứng viên full-text bằng cosine là thay đổi có tác dụng lớn nhất.
2. Vẫn giữ full-text (trọng số 0.5) vì câu có từ khóa / mã môn / thuật ngữ chính xác tốt hơn vector thuần (96.8% so với 92.6% hit@1); thử 0.3 thì câu diễn đạt khác tăng nhẹ nhưng câu từ khóa giảm.
3. Cosine của nguồn đúng: thấp nhất 0.519, p10 0.610, trung vị 0.735 ⇒ `MIN_SIMILARITY` 0.5 (từ 0.45: câu lạc đề vector còn 5 nguồn).
4. Các lần trượt còn lại chủ yếu là bài viết gần như trùng nhau (nhiều bài bot cùng chủ đề sửa CV trên Figma) — câu hỏi mơ hồ giữa các bài đúng như nhau.

Chạy lại sau khi đổi model / ngưỡng / trọng số: cùng `--set` ⇒ so sánh được. Gateway rate-limit (429) ⇒ CLI tự chờ rồi thử lại; model sinh câu hỏi đổi bằng `RAG_EVAL_MODEL` (mặc định không dùng `AI_MODEL` đang phục vụ người dùng).

## 7. Hạn chế đã biết (rà soát 2026-10-19)

Rà soát sau bản đầu tìm ra 8 lỗ hổng; đã sửa ở pipeline v2 (`INDEX_VERSION = 2`, 36 tài liệu cũ tự index lại):

| # | Vấn đề | Trạng thái |
|---|---|---|
| 1 | 1 input hỏng làm cả lô embedding lỗi, kẹt hàng đợi; lỗi dữ liệu bị coi là server sập | ✅ `embedEach` thử từng mục, đánh dấu `error:<model>` |
| 2 | Làm sạch mỏng (78/253 đoạn không NFC, header/footer lặp, dòng ngắt, font cũ) | ✅ `text-cleaner.ts` |
| 3 | Đoạn không mang tiêu đề mục | ✅ `document_chunks.heading` vào input embedding + thân nguồn |
| 4 | Đề thi: đề và lời giải cách xa | ✅ ghép "Câu N" ↔ "Lời giải Câu N" khi trả nguồn |
| 5 | Không OCR | ✅ `OcrService` (trang scan + trang chữ rác) |
| 6 | Cắt im lặng khi tài liệu quá dài | ✅ trạng thái `partial` |
| 7 | Tệp trùng ⇒ 2 nguồn giống nhau | ✅ `content_hash`, gộp khi tìm |
| 8 | Đổi tiêu đề tài liệu không embedding lại | ✅ `source_hash` của input |

Còn lại: OCR gọi gateway nên tốn quota gateway (không tính vào quota người dùng, không ghi `ai_runs`); OCR chạy ngay trong lượt quét (tài liệu scan 30 trang ≈ 6 phút chặn các tài liệu sau trong lượt đó); nhận diện tiêu đề dựa trên mẫu nên có thể nhầm dòng đánh số trong bài tập thành tiêu đề.

### Chọn OCR: gateway hay model local

Đo trên 2 trang giả bản scan (xoay 1.2°, JPEG chất lượng thấp, có dấu tiếng Việt, công thức, code SQL), CER = tỉ lệ ký tự sai so với lớp chữ gốc:

| Model | CER | Thời gian/trang |
|---|---|---|
| Gateway `gemini-3.7-flash-medium` | **0.5–0.7%** | 11–15s |
| Gateway `gemini-3.8-flash-low` | 0.5–0.7% | 10–16s |
| Mac mini Ollama `qwen2.5vl:7b` | 1.0–7.6% | 40–60s (~6GB RAM) |
| Mac mini Ollama `gemma3:4b` | lặp chữ, không dùng được | 140s |

⇒ Mặc định gateway với model riêng `OCR_MODEL` (không phải `AI_MODEL` đang phục vụ người dùng). Chuyển sang local không sửa code: `OCR_BASE_URL=http://127.0.0.1:11435/v1`, `OCR_MODEL=qwen2.5vl:7b`. Tắt: `OCR_ENABLED=false`. Render trang trên VPS: ~0.8s, ~106MB RAM / trang.

## 8. Test

`apps/api/test/rag-search.e2e-spec.ts` (server embedding giả theo nhóm từ đồng nghĩa + R2 giả): cắt đoạn, worker trích tệp R2 / từ chối URL ngoài, embedding lại bài đã sửa, câu hỏi khác chữ chỉ hybrid tìm ra, quyền xem tài liệu riêng tư / bài ẩn, hybrid loại kết quả full-text khớp chữ nhưng xa nghĩa, làm sạch (NFC, header/footer, nối dòng, chữ rác TCVN3), đường dẫn tiêu đề mục, OCR trang scan / chữ rác (lớp chữ PDF được giả lập vì pdfjs không chạy trong VM của Jest), lô embedding có input hỏng, đổi tiêu đề / nâng phiên bản pipeline / tệp trùng, ghép đề ↔ lời giải.
