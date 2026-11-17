#!/usr/bin/env bash
# One-time setup on a Debian/Ubuntu VM. Run as a sudo-capable user:
#   FINPULSE_HOST=35-192-142-253.sslip.io bash setup-vm.sh
# Installs Node 22 and Caddy, creates the finpulse user and the systemd service.
# Does not touch other services on the machine.
set -euo pipefail
: "${FINPULSE_HOST:?set FINPULSE_HOST, e.g. 1-2-3-4.sslip.io}"
REPO=https://github.com/Hort1934/FinPulse-Agent.git

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update && sudo apt-get install -y caddy
fi
sudo apt-get install -y git

id finpulse >/dev/null 2>&1 || sudo useradd --system --home /opt/finpulse --shell /usr/sbin/nologin finpulse
sudo mkdir -p /opt/finpulse/data
[ -d /opt/finpulse/app/.git ] || sudo git clone "$REPO" /opt/finpulse/app
if [ ! -f /opt/finpulse/.env ]; then
  sudo cp /opt/finpulse/app/.env.example /opt/finpulse/.env
  echo ">> Fill in /opt/finpulse/.env (SoSoValue + Gemini keys), then run deploy/update.sh"
fi
sudo chown -R finpulse:finpulse /opt/finpulse
sudo chmod 600 /opt/finpulse/.env

sudo cp /opt/finpulse/app/deploy/finpulse.service /etc/systemd/system/finpulse.service
sudo cp /opt/finpulse/app/deploy/Caddyfile /etc/caddy/Caddyfile
echo "FINPULSE_HOST=$FINPULSE_HOST" | sudo tee /etc/default/caddy >/dev/null
sudo mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironmentFile=/etc/default/caddy\n' | sudo tee /etc/systemd/system/caddy.service.d/env.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable finpulse caddy
sudo systemctl restart caddy
echo ">> Setup done. Next: fill /opt/finpulse/.env, then: sudo bash /opt/finpulse/app/deploy/update.sh"
