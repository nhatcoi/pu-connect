#!/usr/bin/env bash
# ==============================================================================
# Model kiểm duyệt (ViSoBERT ONNX) chạy trên Mac — VPS gọi qua reverse SSH tunnel
#   VPS 127.0.0.1:11436  ──ssh -R──▶  Mac 127.0.0.1:11436 (sidecar scripts/ops/moderation-sidecar.ts)
# Cổng chỉ ở loopback; launchd tự chạy lại sidecar và tunnel. Cần apps/api/models/visobert-onnx (không commit, ~100MB).
# Chạy trên Mac: bash scripts/ops/setup-moderation-tunnel.sh   (gỡ: --remove)
# VPS .env: MODERATION_CLASSIFIER_URL=http://127.0.0.1:11436   (không có/ Mac tắt ⇒ API chỉ dùng tầng luật)
# ==============================================================================
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@103.195.237.112}"
PORT="${PORT:-11436}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NODE="$(command -v node)"
SIDECAR_LABEL="dev.vnhat.pu-moderation-sidecar"
TUNNEL_LABEL="dev.vnhat.pu-moderation-tunnel"
AGENTS="$HOME/Library/LaunchAgents"
LOGS="$HOME/Library/Logs"

if [ "${1:-}" = "--remove" ]; then
  for l in "$SIDECAR_LABEL" "$TUNNEL_LABEL"; do
    launchctl bootout "gui/$(id -u)/$l" 2>/dev/null || true
    rm -f "$AGENTS/$l.plist"
  done
  echo "Đã gỡ sidecar và tunnel kiểm duyệt"
  exit 0
fi

[ -f "$ROOT/apps/api/models/visobert-onnx/model_int8.onnx" ] || { echo "Thiếu model: apps/api/models/visobert-onnx/model_int8.onnx"; exit 1; }
[ -f "$ROOT/apps/api/node_modules/ts-node/dist/bin.js" ] || { echo "Chưa cài dependencies: pnpm install"; exit 1; }
ssh -o BatchMode=yes -o ConnectTimeout=5 "$VPS_HOST" true || { echo "Không SSH được $VPS_HOST bằng key"; exit 1; }
mkdir -p "$AGENTS" "$LOGS"

cat > "$AGENTS/$SIDECAR_LABEL.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$SIDECAR_LABEL</string>
  <key>WorkingDirectory</key><string>$ROOT/apps/api</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$ROOT/apps/api/node_modules/ts-node/dist/bin.js</string>
    <string>--transpile-only</string>
    <string>--compiler-options</string><string>{"module":"commonjs"}</string>
    <string>$ROOT/scripts/ops/moderation-sidecar.ts</string>
  </array>
  <key>EnvironmentVariables</key><dict><key>MODERATION_SIDECAR_PORT</key><string>$PORT</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>15</integer>
  <key>StandardOutPath</key><string>$LOGS/$SIDECAR_LABEL.log</string>
  <key>StandardErrorPath</key><string>$LOGS/$SIDECAR_LABEL.log</string>
</dict>
</plist>
EOF

cat > "$AGENTS/$TUNNEL_LABEL.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$TUNNEL_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/ssh</string>
    <string>-N</string>
    <string>-o</string><string>BatchMode=yes</string>
    <string>-o</string><string>ExitOnForwardFailure=yes</string>
    <string>-o</string><string>ServerAliveInterval=30</string>
    <string>-o</string><string>ServerAliveCountMax=3</string>
    <string>-R</string><string>127.0.0.1:$PORT:127.0.0.1:$PORT</string>
    <string>$VPS_HOST</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>15</integer>
  <key>StandardErrorPath</key><string>$LOGS/$TUNNEL_LABEL.log</string>
</dict>
</plist>
EOF

for l in "$SIDECAR_LABEL" "$TUNNEL_LABEL"; do
  launchctl bootout "gui/$(id -u)/$l" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$AGENTS/$l.plist"
done

for _ in $(seq 1 30); do curl -sf "http://127.0.0.1:$PORT/health" >/dev/null && break; sleep 1; done
curl -sf "http://127.0.0.1:$PORT/health" >/dev/null || { echo "Sidecar chưa lên, xem log: $LOGS/$SIDECAR_LABEL.log"; exit 1; }
sleep 2
if ssh -o BatchMode=yes "$VPS_HOST" "curl -sf -X POST -H 'content-type: application/json' -d '{\"text\":\"xin chào\"}' http://127.0.0.1:$PORT/classify" | grep -q clean; then
  echo "OK: VPS 127.0.0.1:$PORT → sidecar kiểm duyệt trên Mac"
else
  echo "Tunnel chưa lên, xem log: $LOGS/$TUNNEL_LABEL.log"
  exit 1
fi
