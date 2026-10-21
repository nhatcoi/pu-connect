#!/usr/bin/env bash
# Entrypoint shortcut for scripts/deploy-mac-vps.sh
exec bash "$(dirname "$0")/scripts/deploy-mac-vps.sh" "$@"
