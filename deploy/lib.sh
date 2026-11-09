#!/usr/bin/env bash
# Thư viện dùng chung cho các lệnh deploy (source, không chạy trực tiếp). Chạy trên máy dev; phần chạy trên VPS nằm ở deploy/remote/.
# Tương thích bash 3.2 (macOS).
set -Eeuo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$DEPLOY_DIR")"
VPS_HOST="${VPS_HOST:-root@103.195.237.112}"
VPS_DIR="${VPS_DIR:-/var/www/pu-connector}"
DOMAIN="${DOMAIN:-puc.vnhat.dev}"
LOCK_FILE=/var/lock/pu-deploy.lock

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
say()  { echo -e "${BLUE}$*${NC}"; }
step() { echo -e "\n${YELLOW}[$1]${NC} $2"; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
warn() { echo -e "${YELLOW}! $*${NC}"; }
die()  { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

SSH_OPTS="-o ServerAliveInterval=15 -o ServerAliveCountMax=6"
rssh() { ssh $SSH_OPTS "$VPS_HOST" "$@"; }
# Chạy script trong deploy/remote/ trên VPS (đã được sync) tại thư mục dự án: remote <script> [tham số...]
# Biến môi trường cho script: REMOTE_ENV="KEY=VAL KEY2=VAL2" remote <script>
remote() {
  local script=$1; shift
  rssh "cd $VPS_DIR && env ${REMOTE_ENV:-} bash deploy/remote/$script $*"
}

check_ssh() {
  step "ssh" "Kiểm tra kết nối tới VPS..."
  ssh -o BatchMode=yes -o ConnectTimeout=8 "$VPS_HOST" 'echo ok' >/dev/null 2>&1 || die "Không kết nối SSH được tới $VPS_HOST (kiểm tra mạng / SSH key / VPS đang chạy)."
  ok "SSH $VPS_HOST"
}

# Báo phạm vi: deploy lấy working tree, KHÔNG phải commit
scope_report() {
  command -v git >/dev/null 2>&1 || return 0
  local n; n=$(cd "$ROOT_DIR" && git status --short 2>/dev/null | wc -l | tr -d ' ')
  if [ "${n:-0}" -gt 0 ]; then
    warn "Working tree có $n thay đổi chưa commit/untracked — tất cả sẽ được đưa lên VPS (kể cả WIP của session khác)."
  fi
}

# ── Khóa deploy trên VPS: 1 deploy một lúc. Khóa gắn với phiên SSH nên máy dev chết thì tự nhả ─────────────────────────
LOCK_PID=""; LOCK_FIFO=""; LOCK_OUT=""
acquire_lock() {
  [ "${DEPLOY_LOCKED:-}" = "1" ] && return 0
  LOCK_FIFO="$(mktemp -u "${TMPDIR:-/tmp}/pu-lock-fifo.XXXXXX")"; LOCK_OUT="$(mktemp "${TMPDIR:-/tmp}/pu-lock-out.XXXXXX")"
  mkfifo "$LOCK_FIFO"
  local who="${USER:-?}@$(hostname -s) $(date '+%H:%M:%S') $1"
  ssh $SSH_OPTS "$VPS_HOST" "exec 9>$LOCK_FILE; flock -n 9 || { echo \"BUSY \$(cat $LOCK_FILE.info 2>/dev/null)\"; exit 75; }; echo '$who' > $LOCK_FILE.info; echo LOCKED; cat >/dev/null" < "$LOCK_FIFO" > "$LOCK_OUT" 2>&1 &
  LOCK_PID=$!
  exec 8> "$LOCK_FIFO"
  local i
  for i in $(seq 1 40); do
    if grep -q '^LOCKED' "$LOCK_OUT" 2>/dev/null; then export DEPLOY_LOCKED=1; ok "Đã khóa deploy trên VPS"; return 0; fi
    if grep -q '^BUSY' "$LOCK_OUT" 2>/dev/null; then die "VPS đang có deploy khác ($(sed -n 's/^BUSY //p' "$LOCK_OUT")). Đợi nó xong rồi chạy lại."; fi
    sleep 0.5
  done
  die "Không lấy được khóa deploy (SSH chậm?)."
}
release_lock() {
  [ -n "$LOCK_PID" ] || return 0
  exec 8>&- 2>/dev/null || true
  wait "$LOCK_PID" 2>/dev/null || true
  rm -f "$LOCK_FIFO" "$LOCK_OUT"; LOCK_PID=""
}
trap release_lock EXIT

# Sync working tree lên VPS (--delete). Không đụng .env, slot web, node_modules, build output
sync_tree() {
  [ "${DEPLOY_SYNCED:-}" = "1" ] && return 0
  step "sync" "Đồng bộ mã nguồn lên $VPS_DIR..."
  scope_report
  rssh "mkdir -p $VPS_DIR"
  local out
  out=$(cd "$ROOT_DIR" && rsync -az --delete --stats \
    --exclude 'node_modules' --exclude '.next' --exclude '.next-*' --exclude '.web-slot.*' --exclude 'dist' --exclude '.turbo' \
    --exclude 'apps/api/models' --exclude '.git' --exclude '.env' --exclude '.env.local' \
    --exclude 'puc-client-secret*.json' --exclude 'client_secret*.json' --exclude '*.log' --exclude '.DS_Store' --exclude '*.local.md' \
    --exclude 'tools/fb-group-digest' \
    ./ "$VPS_HOST:$VPS_DIR/") || die "rsync lỗi."
  echo "$out" | grep -E 'files transferred|Total transferred' || true
  export DEPLOY_SYNCED=1
}

# Mở đầu một lệnh deploy: SSH → khóa → sync (bỏ qua phần đã làm khi chạy từ all.sh)
begin() {
  say "══ PU CONNECT · deploy $1 → $DOMAIN ══"
  check_ssh
  acquire_lock "$1"
  sync_tree
}

http_code() { curl -s -o /dev/null -m 15 -w '%{http_code}' "$1" || true; }
