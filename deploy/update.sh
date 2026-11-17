#!/usr/bin/env bash
# Pull main, install, build and restart. Safe to re-run. Usage: sudo bash deploy/update.sh
set -euo pipefail
cd /opt/finpulse/app
sudo -u finpulse git pull --ff-only
# The build needs dev dependencies (vite); on 1 GB RAM give Node a bounded heap.
sudo -u finpulse npm ci --no-audit --no-fund
sudo -u finpulse env NODE_OPTIONS=--max-old-space-size=512 npm run build
sudo -u finpulse npm prune --omit=dev --no-audit --no-fund
sudo systemctl restart finpulse
sleep 2
curl -fsS http://127.0.0.1:3001/api/status && echo && echo ">> FinPulse is up"
