# CLAUDE.md

Quy tắc dự án nằm ở [`AGENTS.md`](AGENTS.md); đọc và tuân thủ toàn bộ.

## 🚦 Deploy (tóm tắt, chi tiết ở AGENTS.md mục 7)

- **Làm xong thì tự deploy** bằng skill `deploy` / `scripts/deploy.sh`. Không còn session cổng gác `DevOpsVPS-CICD`, không gửi `SendMessage` xin deploy.
- Typecheck/lint/build trước; chỉ stage hunk của mình (worktree dùng chung với Antigravity/Codex/Claude khác).
- `deploy.sh` rsync cả working tree (gồm WIP + untracked của session khác), không theo commit. Báo WIP bị kéo theo; muốn chỉ deploy commit thì rsync từ bản copy sạch của `HEAD`.
- Verify web/admin/API sau deploy; dừng hỏi user khi check fail hoặc migration phá hủy.
