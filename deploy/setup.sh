#!/usr/bin/env bash
# =============================================================================
# ContentForge — Hetzner CX32 one-time server setup
# Run as root (or sudo) on a fresh Ubuntu 24.04 image
# Usage: bash deploy/setup.sh
# =============================================================================
set -euo pipefail

APP_DIR="/opt/contentforge"
APP_USER="cf"

echo "==> [1/6] System update"
apt-get update -qq && apt-get upgrade -y -qq

echo "==> [2/6] Install dependencies"
apt-get install -y -qq \
  curl git ufw fail2ban \
  ca-certificates gnupg lsb-release

echo "==> [3/6] Install Docker"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable --now docker
echo "    Docker $(docker --version)"

echo "==> [4/6] Create app user and directory"
if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
fi
usermod -aG docker "$APP_USER"
mkdir -p "$APP_DIR"
chown "$APP_USER":"$APP_USER" "$APP_DIR"

echo "==> [5/6] Configure firewall (ufw)"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
# Port 443 ready for when you add a domain + SSL
ufw allow 443/tcp comment "HTTPS (future)"
ufw --force enable
ufw status

echo "==> [6/6] Enable fail2ban"
systemctl enable --now fail2ban

echo ""
echo "✅  Server setup complete."
echo ""
echo "Next steps:"
echo "  1. As user $APP_USER, clone the repo:"
echo "       su - $APP_USER"
echo "       git clone <your-repo-url> $APP_DIR"
echo "  2. Copy and fill in production env:"
echo "       cp $APP_DIR/.env.prod.example $APP_DIR/.env.prod"
echo "       nano $APP_DIR/.env.prod"
echo "  3. Deploy:"
echo "       cd $APP_DIR && bash deploy/deploy.sh"
