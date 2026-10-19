#!/usr/bin/env bash
# ==============================================================================
# Server embedding cho RAG N7AI chạy trên Mac mini (Ollama) — VPS gọi qua reverse SSH tunnel
#   VPS 127.0.0.1:11435  ──ssh -R──▶  Mac mini 127.0.0.1:11434 (Ollama)
# Cổng chỉ mở ở loopback của VPS (không lộ ra internet); launchd tự nối lại khi rớt mạng / khởi động lại
# Chạy trên Mac mini: bash scripts/ops/setup-embed-tunnel.sh   (gỡ: bash scripts/ops/setup-embed-tunnel.sh --remove)
# VPS .env: EMBED_BASE_URL=http://127.0.0.1:11435/v1  EMBED_MODEL=qwen3-embedding:0.6b
# ==============================================================================
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@103.195.237.112}"
REMOTE_PORT="${REMOTE_PORT:-11435}"
MODEL="${EMBED_MODEL:-qwen3-embedding:0.6b}"
LABEL="dev.vnhat.pu-embed-tunnel"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/$LABEL.log"

if [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Đã gỡ tunnel $LABEL"
  exit 0
fi

command -v ollama >/dev/null || { echo "Thiếu Ollama: brew install ollama"; exit 1; }
# Ollama chạy nền như dịch vụ (tự bật khi đăng nhập), tải model nếu chưa có
brew services start ollama >/dev/null
for _ in $(seq 1 20); do curl -sf http://127.0.0.1:11434/api/version >/dev/null && break; sleep 1; done
ollama pull "$MODEL" >/dev/null
ssh -o BatchMode=yes -o ConnectTimeout=5 "$VPS_HOST" true || { echo "Không SSH được $VPS_HOST bằng key"; exit 1; }

mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/ssh</string>
    <string>-N</string>
    <string>-o</string><string>BatchMode=yes</string>
    <string>-o</string><string>ExitOnForwardFailure=yes</string>
    <string>-o</string><string>ServerAliveInterval=30</string>
    <string>-o</string><string>ServerAliveCountMax=3</string>
    <string>-R</string><string>127.0.0.1:$REMOTE_PORT:127.0.0.1:11434</string>
    <string>$VPS_HOST</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>15</integer>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 3
if ssh -o BatchMode=yes "$VPS_HOST" "curl -sf http://127.0.0.1:$REMOTE_PORT/api/version" >/dev/null; then
  echo "Tunnel OK: VPS 127.0.0.1:$REMOTE_PORT → Ollama ($MODEL)"
else
  echo "Tunnel chưa lên, xem log: $LOG"
  exit 1
fi
