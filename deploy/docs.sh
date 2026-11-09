#!/usr/bin/env bash
# Deploy Docs (SPA tĩnh): build apps/docs/dist.  Dùng: bash deploy/docs.sh  (pnpm run deploy:docs)
source "$(dirname "$0")/lib.sh"
begin docs
step "docs" "Build Docs..."
remote static.sh docs
ok "Docs xong"
