#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 VPS for MotionDots. Run as root:
#   bash setup.sh
# Installs Node 22, Caddy (HTTPS), pm2, ffmpeg, fonts and what Chrome needs to
# render videos; makes the "motiondots" user with its own SSH key (for GitHub);
# opens only ports 22, 80, 443; adds 4 GB of swap. Safe to run again.
set -euo pipefail
APP_USER=motiondots

echo "== system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git ufw ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https \
  ffmpeg fonts-noto fonts-noto-cjk fonts-noto-color-emoji fonts-beng \
  libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libasound2t64 libpango-1.0-0 libcairo2 libxshmfence1 libx11-xcb1

echo "== Node.js 22"
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

echo "== Caddy (HTTPS)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "== firewall: ssh, http, https only"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== 4 GB swap (a render can need it)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== the app's user, and its key for GitHub (read-only deploy key)"
id "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
if [ ! -f "/home/$APP_USER/.ssh/id_ed25519" ]; then
  sudo -u "$APP_USER" mkdir -p "/home/$APP_USER/.ssh"
  sudo -u "$APP_USER" ssh-keygen -t ed25519 -N "" -C "motiondots-vps" -f "/home/$APP_USER/.ssh/id_ed25519" >/dev/null
  sudo -u "$APP_USER" sh -c "ssh-keyscan github.com >> /home/$APP_USER/.ssh/known_hosts 2>/dev/null"
fi

echo "== pm2 starts with the server"
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null

echo
echo "Done. Add this key on GitHub → the repository → Settings → Deploy keys (read only):"
echo
cat "/home/$APP_USER/.ssh/id_ed25519.pub"
echo
echo "Then follow deploy/README.md from step 4 (clone, .env.production, deploy.sh, Caddy)."
