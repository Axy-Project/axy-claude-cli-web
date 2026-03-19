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
  # Generate random JWT secret
  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')
  DB_PASSWORD=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')

  sed -i.bak "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env 2>/dev/null || \
    sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
  sed -i.bak "s|DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" .env 2>/dev/null || \
    sed -i '' "s|DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" .env
  rm -f .env.bak

  echo "🔑 Generated random JWT_SECRET and DB_PASSWORD"
  echo ""
  echo "⚠️  Edit $INSTALL_DIR/.env to add your Supabase keys:"
  echo "   SUPABASE_URL=https://your-project.supabase.co"
  echo "   SUPABASE_ANON_KEY=your-anon-key"
  echo ""
fi

# Pull and start
echo "🐳 Pulling images..."
docker compose pull

echo "🚀 Starting Axy Web..."
docker compose up -d

echo ""
echo "  ✅ Axy Web is running!"
echo ""
echo "  🌐 Open: http://localhost:3457"
echo "  📦 API:  http://localhost:3456"
echo ""
echo "  📁 Data: $INSTALL_DIR"
echo "  🔄 Auto-updates enabled via Watchtower"
echo ""
echo "  Commands:"
echo "    cd $INSTALL_DIR"
echo "    docker compose logs -f        # View logs"
echo "    docker compose pull && docker compose up -d  # Manual update"
echo "    docker compose down            # Stop"
echo ""
