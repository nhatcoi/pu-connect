#!/usr/bin/env bash
# Kiểm tra sau deploy (CHỈ ĐỌC): Web 200, Admin 200, Docs 200, API 401 (web + admin), pu-api/pu-web active, nginx -t.
# Thoát khác 0 nếu có mục sai.  Dùng: bash deploy/verify.sh  (pnpm run deploy:verify)
source "$(dirname "$0")/lib.sh"
step "verify" "Kiểm tra sức khỏe..."
fail=0
check() { # tên url mong đợi
  local code i
  for i in 1 2 3 4 5; do code=$(http_code "$2"); [ "$code" = "$3" ] && break; sleep 2; done
  if [ "$code" = "$3" ]; then ok "$1 $code"; else echo -e "${RED}✗ $1: $code (mong đợi $3)${NC}"; fail=1; fi
}
check "Web   https://$DOMAIN/"                 "https://$DOMAIN/"                    200
check "Admin https://admin-$DOMAIN/"           "https://admin-$DOMAIN/"              200
check "Docs  https://docs-$DOMAIN/"            "https://docs-$DOMAIN/"               200
check "API   /api/auth/me (không phiên)"      "https://$DOMAIN/api/auth/me"         401
check "Admin /api/auth/me (không phiên)"      "https://admin-$DOMAIN/api/auth/me"   401
svc=$(rssh "systemctl is-active pu-api pu-web | tr '\n' ' '; nginx -t >/dev/null 2>&1 && echo nginx-ok || echo nginx-LỖI" 2>/dev/null || echo "ssh-lỗi")
if [ "$svc" = "active active nginx-ok " ] || [ "$svc" = "active active nginx-ok" ]; then ok "pu-api, pu-web active; nginx -t ok"; else echo -e "${RED}✗ dịch vụ: $svc${NC}"; fail=1; fi
[ "$fail" = 0 ] && ok "Mọi kiểm tra đạt" || die "Có mục kiểm tra không đạt. Xem: ssh $VPS_HOST 'journalctl -u pu-web -n 50 --no-pager'"
