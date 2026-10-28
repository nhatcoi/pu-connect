# 🚀 Triển khai & DevOps — PU Connect Deployment & DevOps Guide

Tài liệu này hướng dẫn cách cấu hình môi trường, đóng gói container Docker và triển khai hệ thống **PU Connect** lên môi trường Production (VPS, Cloudflare R2, Vercel, AWS/DigitalOcean).

---

## 1. Biến Môi trường (Environment Variables)

### 1.1. Cấu hình Web (`apps/web/.env.production`)
```bash
# URL của NestJS Backend API
NEXT_PUBLIC_API_URL=https://api.puconnector.com/api

# WebSocket Server URL
NEXT_PUBLIC_WS_URL=wss://api.puconnector.com

# Domain ứng dụng
NEXT_PUBLIC_APP_URL=https://puconnector.com
```

### 1.2. Cấu hình Backend (`apps/api/.env.production`)
```bash
# Port và Host
PORT=4000
HOST=0.0.0.0

# Bảo mật JWT
JWT_SECRET=super_secure_random_jwt_secret_key_change_me_in_prod

# PostgreSQL Database
DATABASE_URL=postgresql://pu_user:pu_password@postgres:5432/pu_connector_db?sslmode=require

# Redis Cache & Queue
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=pu_redis_password

# Cloudflare R2 / AWS S3 Storage
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your_r2_access_key
S3_SECRET_ACCESS_KEY=your_r2_secret_key
S3_BUCKET_NAME=pu-connector-storage
S3_PUBLIC_DOMAIN=https://cdn.puconnector.com
```

---

## 2. Đóng gói Docker Container (Production Multi-stage Dockerfile)

### `docker-compose.production.yml`
```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: pu_postgres
    restart: always
    environment:
      POSTGRES_USER: pu_user
      POSTGRES_PASSWORD: pu_password
      POSTGRES_DB: pu_connector_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    container_name: pu_redis
    restart: always
    command: redis-server --requirepass pu_redis_password
    ports:
      - "6379:6379"

  api:
    build:
      context: .
      dockerfile: ./apps/api/Dockerfile
    container_name: pu_api
    restart: always
    environment:
      - PORT=4000
      - HOST=0.0.0.0
      - DATABASE_URL=postgresql://pu_user:pu_password@postgres:5432/pu_connector_db
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    ports:
      - "4000:4000"

  web:
    build:
      context: .
      dockerfile: ./apps/web/Dockerfile
    container_name: pu_web
    restart: always
    ports:
      - "3000:3000"

volumes:
  postgres_data:
```

---

## 3. Cấu hình Nginx Reverse Proxy & SSL (Certbot Let's Encrypt)

```nginx
# /etc/nginx/sites-available/puconnector.com

# 1. Frontend Next.js Web
server {
    server_name puconnector.com www.puconnector.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 2. Backend NestJS API & WebSocket
server {
    server_name api.puconnector.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Kiểm tra sức khỏe hệ thống (Health Check & Monitoring)

* **Web Health:** `curl -I https://puconnector.com` $\rightarrow$ `HTTP/2 200`
* **API Health:** `curl -I https://api.puconnector.com/api/posts` $\rightarrow$ `HTTP/2 200`
* **Log kiểm tra thời gian thực:** `docker logs -f pu_api` hoặc `pm2 logs`
