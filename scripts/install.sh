#!/bin/bash
# =============================================================================
# Axy Web - One-line installer
# Usage: curl -fsSL https://raw.githubusercontent.com/Axy-Project/AxyWeb/main/scripts/install.sh | bash
# =============================================================================

set -e

echo ""
echo "  ╔═══════════════════════════════════╗"
echo "  ║         Axy Web Installer         ║"
echo "  ╚═══════════════════════════════════╝"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is required but not installed."
  echo "   Install: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo "❌ Docker Compose V2 is required."
  exit 1
fi

INSTALL_DIR="${AXY_DIR:-$HOME/axy-web}"

echo "📁 Installing to: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Download production compose file
echo "⬇️  Downloading config..."
curl -fsSL https://raw.githubusercontent.com/Axy-Project/AxyWeb/main/docker-compose.prod.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/Axy-Project/AxyWeb/main/.env.example -o .env.example

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env

  # Generate random secrets
  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')
  DB_PASSWORD=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')

  # Replace in .env (macOS + Linux compatible)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|DB_PASSWORD=change_me_to_random_string|DB_PASSWORD=$DB_PASSWORD|g" .env
    sed -i '' "s|JWT_SECRET=change_me_to_random_string_min_32_chars|JWT_SECRET=$JWT_SECRET|g" .env
    sed -i '' "s|DATABASE_URL=postgres://axy:change_me_to_random_string@|DATABASE_URL=postgres://axy:$DB_PASSWORD@|g" .env
  else
    sed -i "s|DB_PASSWORD=change_me_to_random_string|DB_PASSWORD=$DB_PASSWORD|g" .env
    sed -i "s|JWT_SECRET=change_me_to_random_string_min_32_chars|JWT_SECRET=$JWT_SECRET|g" .env
    sed -i "s|DATABASE_URL=postgres://axy:change_me_to_random_string@|DATABASE_URL=postgres://axy:$DB_PASSWORD@|g" .env
  fi

  echo "🔑 Generated random secrets"
fi

# Pull and start
echo "🐳 Pulling images..."
docker compose pull

echo "🚀 Starting Axy Web..."
docker compose up -d

# Wait for services
echo "⏳ Waiting for services..."
sleep 5

# Get server IP
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo "  ✅ Axy Web is running!"
echo ""
echo "  🌐 Open: http://${SERVER_IP}:3457"
echo "  📦 API:  http://${SERVER_IP}:3456"
echo ""
echo "  First time? The setup wizard will guide you."
echo "  Create your admin account and sign in to Claude."
echo ""
echo "  📁 Data: $INSTALL_DIR"
echo "  🔄 Auto-updates enabled (Watchtower checks every 5 min)"
echo ""
echo "  Commands:"
echo "    cd $INSTALL_DIR"
echo "    docker compose logs -f          # View logs"
echo "    docker compose pull && up -d    # Manual update"
echo "    docker compose down             # Stop"
echo ""
