#!/usr/bin/env bash
# Chạy trên VPS, CHỈ ĐỌC: trạng thái dịch vụ, slot web, tài nguyên, tiến trình build đang chạy.
cd "${VPS_DIR:-/var/www/pu-connector}" 2>/dev/null || cd "$(dirname "$0")/../.."
echo "── Dịch vụ"; for s in pu-api pu-web nginx; do printf '%-8s %s\n' "$s" "$(systemctl is-active $s 2>&1)"; done
echo "── Slot web"; echo "live: $(cat .web-slot.env 2>/dev/null || echo '(chưa có)')  prev: $(cat .web-slot.env.prev 2>/dev/null || echo '(chưa có)')"
for d in apps/web/.next-a apps/web/.next-b; do [ -f "$d/BUILD_ID" ] && echo "$d BUILD_ID=$(cat $d/BUILD_ID) $(stat -c %y "$d/BUILD_ID" 2>/dev/null | cut -c1-16)"; done
echo "── Admin / Docs dist"; for d in apps/admin/dist apps/docs/dist; do [ -f "$d/index.html" ] && echo "$d $(stat -c %y "$d/index.html" | cut -c1-16)" || echo "$d (thiếu)"; done
echo "── Tài nguyên"; free -m | sed -n 2p; df -h /var/www | tail -1
echo "── Deploy đang chạy"
if [ -f /var/lock/pu-deploy.lock ] && ! flock -n /var/lock/pu-deploy.lock true 2>/dev/null; then echo "ĐANG CÓ: $(cat /var/lock/pu-deploy.lock.info 2>/dev/null)"; else echo "không"; fi
pgrep -af 'next build|turbo run|rsync --server' | grep -v pgrep | cut -c1-120 || true
