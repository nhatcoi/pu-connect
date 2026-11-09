#!/usr/bin/env bash
# Chạy trên VPS: build Web vào slot rảnh (blue/green), chuyển slot, restart pu-web. Web lỗi sau khi chuyển ⇒ tự quay về slot trước.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
WEB_PORT="$(sed -n 's/^WEB_PORT=//p' .env 2>/dev/null | head -1)"; WEB_PORT="${WEB_PORT:-3000}"

# packages dùng chung (@pu/schemas…) phải được build trước khi build Web
bash deploy/remote/build.sh '@pu/web^...'

# Web blue/green: build vào slot rảnh, server cũ vẫn phục vụ slot đang chạy ⇒ không lỗi chunk giữa lúc build
# (gọi thẳng next build: cache output của turbo gắn với .next/**)
LIVE=$(sed -n 's/^NEXT_DIST_DIR=//p' .web-slot.env 2>/dev/null || true)
LIVE=${LIVE:-.next}
[ "$LIVE" = ".next-a" ] && SLOT=.next-b || SLOT=.next-a
echo "Build Web vào apps/web/$SLOT (đang chạy: $LIVE)..."
# Mồi cache chung từ cache thật của slot đang chạy (lần đầu chuyển sang slot)
if [ ! -d apps/web/.next-cache ] && [ -d "apps/web/$LIVE/cache" ] && [ ! -L "apps/web/$LIVE/cache" ]; then
  mv "apps/web/$LIVE/cache" apps/web/.next-cache
fi
rm -rf "apps/web/$SLOT" && mkdir -p "apps/web/$SLOT" apps/web/.next-cache
ln -s ../.next-cache "apps/web/$SLOT/cache"  # 2 slot dùng chung cache webpack ⇒ build ấm, ít RAM
NEXT_DIST_DIR=$SLOT NEXT_SKIP_CHECKS=1 NODE_OPTIONS="--max-old-space-size=2048" nice -n 10 ionice -c3 pnpm --filter @pu/web build

# Giữ chunk JS của bản trước 7 ngày: tab đang mở HTML cũ chuyển trang vẫn tải được (tránh ChunkLoadError)
if [ -d "apps/web/$LIVE/static" ]; then
  cp -Rnp "apps/web/$LIVE/static/." "apps/web/$SLOT/static/"
  find "apps/web/$SLOT/static" -type f -mtime +7 -delete
fi

# pu-web đọc slot từ .web-slot.env (drop-in, ghi đè .env)
mkdir -p /etc/systemd/system/pu-web.service.d
cat > /etc/systemd/system/pu-web.service.d/slot.conf << 'UNIT'
[Service]
EnvironmentFile=-/var/www/pu-connector/.web-slot.env
UNIT
systemctl daemon-reload
systemctl enable pu-web >/dev/null 2>&1

# Chuyển slot, ghi slot trước để rollback không phải đoán
echo "NEXT_DIST_DIR=$LIVE" > .web-slot.env.prev
echo "NEXT_DIST_DIR=$SLOT" > .web-slot.env
systemctl restart pu-web
for i in $(seq 1 25); do
  code=$(curl -s -o /dev/null -m 3 -w '%{http_code}' "http://127.0.0.1:$WEB_PORT/" || true)
  case "$code" in 200|301|302|307|308) echo "pu-web: ACTIVE trên $SLOT (HTTP $code)"; break ;; esac
  sleep 1
done
case "$code" in 200|301|302|307|308) ;; *)
  echo "pu-web KHÔNG phản hồi trên $SLOT (HTTP $code) — quay về $LIVE."
  echo "NEXT_DIST_DIR=$LIVE" > .web-slot.env
  systemctl restart pu-web
  journalctl -u pu-web -n 20 --no-pager | tail -20
  exit 1 ;;
esac

# Dọn thư mục build cũ trước khi có slot (chỉ khi không còn là slot đang chạy)
if grep -q '^NEXT_DIST_DIR=.next-' .web-slot.env; then rm -rf apps/web/.next; fi
