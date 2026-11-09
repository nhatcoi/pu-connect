#!/usr/bin/env bash
# Rollback Web về slot trước (ghi trong .web-slot.env.prev). Chỉ Web: không hoàn tác API, DB, Admin, Nginx.
# Dùng: bash deploy/rollback.sh  (pnpm run deploy:rollback)
source "$(dirname "$0")/lib.sh"
say "══ PU CONNECT · rollback web ══"
check_ssh
acquire_lock rollback
remote rollback.sh
bash "$DEPLOY_DIR/verify.sh"
