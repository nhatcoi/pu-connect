#!/usr/bin/env bash
# Chạy trên VPS: cấu hình Nginx cho Admin, Docs, IP thật sau Cloudflare; nginx -t rồi reload.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."

# Cấu hình Nginx cho Admin Console (admin-puc.vnhat.dev — Static SPA 0 MB RAM)
cp scripts/ops/nginx-admin-puc.conf /etc/nginx/sites-available/admin-puc.vnhat.dev.conf
ln -sf /etc/nginx/sites-available/admin-puc.vnhat.dev.conf /etc/nginx/sites-enabled/admin-puc.vnhat.dev.conf

# Cấu hình Nginx cho Documentation Portal (docs-puc.vnhat.dev — Static SPA 0 MB RAM)
cp scripts/ops/nginx-docs-puc.conf /etc/nginx/sites-available/docs-puc.vnhat.dev.conf 2>/dev/null || true
ln -sf /etc/nginx/sites-available/docs-puc.vnhat.dev.conf /etc/nginx/sites-enabled/docs-puc.vnhat.dev.conf

# Nếu đã có chứng chỉ SSL Let's Encrypt cho admin-puc.vnhat.dev (hoặc dùng cert puc.vnhat.dev cho Cloudflare Full)
if [ -f /etc/letsencrypt/live/admin-puc.vnhat.dev/fullchain.pem ]; then
  CERT_DIR="/etc/letsencrypt/live/admin-puc.vnhat.dev"
else
  CERT_DIR="/etc/letsencrypt/live/puc.vnhat.dev"
fi

# IP thật của người dùng sau Cloudflare (nhật ký đăng nhập, rate limit) cho PUC + admin
mkdir -p /etc/nginx/snippets
cp scripts/ops/nginx-cloudflare-realip.conf /etc/nginx/snippets/pu-cloudflare-realip.conf
if ! grep -q 'pu-cloudflare-realip' /etc/nginx/sites-available/pu-connector.conf; then
  sed -i '0,/server_name puc.vnhat.dev;/s//server_name puc.vnhat.dev;\n    include \/etc\/nginx\/snippets\/pu-cloudflare-realip.conf;/' /etc/nginx/sites-available/pu-connector.conf
fi

cat > /etc/nginx/sites-available/admin-puc.vnhat.dev.conf << EOF
server {
    listen 80;
    listen [::]:80;
    server_name admin-puc.vnhat.dev;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name admin-puc.vnhat.dev;
    include /etc/nginx/snippets/pu-cloudflare-realip.conf;

    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/pu-connector/apps/admin/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90s;
    }

    location / {
        # index.html không cache ⇒ deploy mới có hiệu lực ngay (assets đã có hash)
        add_header Cache-Control "no-cache" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Robots-Tag "noindex, nofollow" always;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# Reload Nginx
nginx -t && systemctl reload nginx

echo "Nginx: đã reload."
