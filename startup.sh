#!/bin/sh
set -eu
cd /workspace
export GMGN_API_KEY="${GMGN_API_KEY:-gmgn_47f23fd2a6b52e9655b7ba0573f4a617}"
export OPENNEWS_TOKEN="${OPENNEWS_TOKEN:-}"
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
