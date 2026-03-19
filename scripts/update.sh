#!/bin/bash
# Axy Web - Auto-update script
# Usage: ./scripts/update.sh
# Works with Docker Compose deployments

set -e

REPO="https://github.com/Axy-Project/AxyWeb.git"
BRANCH="main"

echo "🔄 Checking for updates..."

# Check current version
CURRENT_VERSION=$(cat VERSION 2>/dev/null || echo "unknown")
echo "   Current version: $CURRENT_VERSION"

# Fetch latest version from GitHub
LATEST_VERSION=$(curl -sf "https://raw.githubusercontent.com/Axy-Project/AxyWeb/$BRANCH/VERSION" 2>/dev/null || echo "unknown")
echo "   Latest version:  $LATEST_VERSION"

if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
  echo "✅ Already up to date (v$CURRENT_VERSION)"
  exit 0
fi

echo "📦 Update available: v$CURRENT_VERSION → v$LATEST_VERSION"
echo ""

# Pull latest code
echo "⬇️  Pulling latest code..."
git pull origin $BRANCH

# Rebuild and restart containers
echo "🐳 Rebuilding Docker containers..."
docker compose build --no-cache

echo "🔄 Restarting services..."
docker compose up -d

echo ""
echo "✅ Updated to v$LATEST_VERSION"
echo "   Server: http://localhost:${SERVER_PORT:-3456}"
echo "   Web:    http://localhost:${WEB_PORT:-3457}"
