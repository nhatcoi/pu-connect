#!/usr/bin/env bash
# Chạy trên VPS: cài dependencies + build các package được chọn, TUẦN TỰ (VPS 2GB RAM, build song song dễ hết bộ nhớ).
# Dùng: build.sh '@pu/api...' '@pu/admin...'   (tham số = biểu thức --filter của turbo; 'x...' = x kèm các package nó phụ thuộc)
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
[ "$#" -gt 0 ] || { echo "Thiếu biểu thức filter"; exit 2; }
echo "pnpm install..."
# onnxruntime-node: bỏ tải bản CUDA (VPS không có GPU, nuget không có gói khớp)
ONNXRUNTIME_NODE_INSTALL=skip pnpm install --reporter=silent
FILTERS=()
for p in "$@"; do FILTERS+=("--filter=$p"); done
echo "Build: $*"
pnpm exec turbo run build --concurrency=1 "${FILTERS[@]}"
