# CLAUDE.md

Quy tắc dự án nằm ở [`AGENTS.md`](AGENTS.md); đọc và tuân thủ toàn bộ.

## 🚦 Deploy Gate (tóm tắt, chi tiết ở AGENTS.md mục 7)

- **KHÔNG tự chạy `pnpm deploy:vps` / `scripts/deploy.sh`.** Mọi deploy đi qua session cổng gác `DevOpsVPS-CICD`.
- Code xong ⇒ `SendMessage` tới `DevOpsVPS-CICD` kèm danh sách file + commit hash đã push + ghi chú migration/env mới.
- Chỉ stage hunk của chính mình (worktree dùng chung với Antigravity/Codex/Claude khác).
- Cổng gác kiểm tra typecheck/lint/build/docs rồi mới deploy và báo lại.
- `deploy.sh` rsync cả working tree (gồm WIP + untracked của session khác), không theo commit. Cổng gác báo WIP bị kéo theo; muốn chỉ deploy commit thì rsync từ bản copy sạch của `HEAD`.
