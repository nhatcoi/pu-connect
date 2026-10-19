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
| `chunkText` | `rag/text-chunker.ts` | Gom đoạn văn tới ~1200 ký tự (tối đa 1600), đoạn quá dài tách theo câu, chồng lấn ~200 ký tự, ≤ 300 đoạn / tài liệu |
| `RagIndexService` | `rag/rag-index.service.ts` | Worker 3 bước ở trên; chỉ tải tệp thuộc R2 của mình (chặn SSRF) |
| `RagIndexProcessor` / `RagIndexQueue` | `rag/rag-index.processor.ts` | Lịch quét 2 phút; `kick()` gộp nhiều lần gọi thành 1 job chờ (`jobId: sweep-now`) |
| `RagSearchService` | `rag/rag-search.service.ts` | Tìm kết hợp bài viết / tài liệu, có `mode` (`hybrid` \| `fulltext` \| `vector`) cho eval |
| `rag-eval.cli.ts` | `rag/rag-eval.cli.ts` | Đánh giá tự động trên dữ liệu thật (mục 6) |

### Trạng thái trích nội dung tài liệu (`documents.index_status`)

`pending` → `indexing` (worker giữ, hạn 15 phút) → `indexed` | `empty` (PDF scan, không có lớp chữ) | `unsupported` (không phải PDF/DOCX/text hoặc URL ngoài R2) | `failed` (lỗi 3 lần). Lỗi lần n ⇒ thử lại sau n × 5 phút. Nhận việc bằng `FOR UPDATE SKIP LOCKED` + chuyển sang `indexing` ⇒ lịch quét và "quét ngay" chạy song song không làm trùng (lỗi race này do e2e phát hiện).

### Bước extraction không phụ thuộc server embedding

Mac mini tắt ⇒ đoạn vẫn được trích và tìm full-text ngay; cột `embedding` để NULL, lượt quét sau bù. Đổi `EMBED_MODEL` ⇒ cột `embedding_model` / `post_embeddings.model` lệch ⇒ worker tự tính lại (số chiều phải giữ 1024, khác thì sửa migration).

## 3. Tìm kết hợp (Reciprocal Rank Fusion)

Mỗi danh sách ứng viên lấy top 24, điểm = Σ trọng số / (60 + hạng):

- **Bài viết**: full-text `posts.search_tsv` ∥ vector `post_embeddings` (văn bản embedding = tiêu đề + nội dung ≤ 4000 ký tự + lời giải đã duyệt ≤ 1500).
- **Tài liệu**: full-text trên đoạn (`document_chunks.search_tsv`) ∥ full-text tiêu đề/mô tả (`documents.search_tsv`, top 10) ∥ vector trên đoạn. Gộp ở mức tài liệu, thân nguồn = mô tả + tối đa 2 đoạn có điểm gộp cao nhất của tài liệu đó (cắt theo ngân sách ký tự cũ: 1500, Research 2500).
- **Lọc nhiễu full-text bằng vector**: khi có vector câu hỏi, ứng viên full-text (bài viết, đoạn, tài liệu) phải có cosine ≥ `MIN_SIMILARITY` (0.5) mới được gộp; nguồn chưa có embedding giữ nguyên. Kết quả vector dưới ngưỡng cũng bị bỏ ⇒ câu hỏi lạc đề không kéo nguồn rác vào prompt.
- **RRF có trọng số**: danh sách full-text × `FULLTEXT_WEIGHT` = 0.5, vector × 1 (env `RAG_FULLTEXT_WEIGHT` chỉ để eval thử).
- HNSW + bộ lọc quyền xem: `SET LOCAL hnsw.iterative_scan = relaxed_order` (pgvector ≥ 0.8) ⇒ vẫn đủ kết quả khi bộ lọc loại bớt.
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

## 7. Hạn chế đã biết & việc tiếp theo (rà soát 2026-10-19)

Eval chạy trên PDF sạch do hệ thống tự render; tệp người dùng thật (slide xuất PDF, scan, font cũ) bẩn hơn. Kiểm tra trên prod: 78/253 đoạn không ở dạng Unicode NFC.

| # | Vấn đề | Ảnh hưởng | Hướng sửa |
|---|---|---|---|
| 1 | **Lô embedding độc**: 1 input làm server lỗi ⇒ cả lô 64 lỗi, lượt quét sau lấy lại đúng lô đó; bài viết (bước sau trong `sweep`) không bao giờ tới; lỗi dữ liệu bị coi là server sập ⇒ tắt vector 60s cho mọi câu hỏi | Kẹt hàng đợi | Lô lỗi ⇒ thử từng mục; mục hỏng đánh dấu (vd. `embedding_model = 'error:<model>'`) và bỏ qua; chỉ lỗi mạng / 5xx mới `markDown` |
| 2 | **Làm sạch mỏng** (chỉ gộp dòng trống, bỏ dấu trang) | Full-text trượt tiếng Việt, embedding nhiễu | Chuẩn hóa NFC; bỏ dòng header/footer lặp ở nhiều trang; nối dòng bị ngắt giữa câu; phát hiện chữ rác (TCVN3/VNI, tỉ lệ ký tự lạ cao) ⇒ `index_status = 'garbled'` |
| 3 | Đoạn không mang heading mục chứa nó | Đoạn giữa mục mất ngữ cảnh | Gắn đường dẫn heading gần nhất vào input embedding: `Tiêu đề › 3. Dijkstra` |
| 4 | Đề thi: đề bài và lời giải cách xa nhau | Hỏi "lời giải câu 3" có thể chỉ ra đề | Ghép đoạn đề với đoạn lời giải cùng số câu, hoặc trả thêm đoạn kề |
| 5 | Không OCR | PDF scan ⇒ `empty`, N7AI chỉ đọc tiêu đề + mô tả | OCR (Tesseract / model vision) cho tài liệu `empty` |
| 6 | Cắt im lặng: > 150 trang hoặc > 300 đoạn | Sách dài mất nửa sau | Ghi trạng thái `partial` + số trang đã đọc |
| 7 | Không chống trùng tệp | Cùng tệp đăng 2 lần ⇒ 2 nguồn giống nhau | Lưu hash nội dung, gộp kết quả trùng khi tìm |
| 8 | Đổi tiêu đề tài liệu không embedding lại đoạn (tiêu đề nằm trong input) | Lệch nhẹ | Lưu hash input như `post_embeddings.source_hash` |

Ưu tiên: 1 → 2 → 3, sau mỗi thay đổi index lại và chạy `rag:eval` cùng bộ câu hỏi để so số.

## 8. Test

`apps/api/test/rag-search.e2e-spec.ts` (server embedding giả theo nhóm từ đồng nghĩa + R2 giả): cắt đoạn, worker trích tệp R2 / từ chối URL ngoài, embedding lại bài đã sửa, câu hỏi khác chữ chỉ hybrid tìm ra, quyền xem tài liệu riêng tư / bài ẩn, hybrid loại kết quả full-text khớp chữ nhưng xa nghĩa.
