# Axy Web Deployment Guide

## Table of Contents

- [Docker Compose (Recommended)](#docker-compose-recommended)
- [Quick Install Script](#quick-install-script)
- [Dokploy / Coolify](#dokploy--coolify)
- [Manual Server Setup](#manual-server-setup)
- [Auto-Updates with Watchtower](#auto-updates-with-watchtower)
- [Reverse Proxy](#reverse-proxy)
- [SSL/TLS Setup](#ssltls-setup)
- [Troubleshooting](#troubleshooting)

---

## Docker Compose (Recommended)

The production Docker Compose uses pre-built images from GitHub Container Registry.

### Prerequisites

- Docker Engine 20.10+
- Docker Compose v2
- At least 1GB RAM

### Steps

```bash
# Create project directory
mkdir axy-web && cd axy-web

# Download production compose file and example env
curl -fsSL https://raw.githubusercontent.com/Axy-Project/axy-claude-cli-web/main/docker-compose.prod.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/Axy-Project/axy-claude-cli-web/main/.env.example -o .env

# Generate secrets
sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$(openssl rand -hex 24)/" .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env

# Start services
docker compose up -d
```

Open `http://your-server:3457` to complete the setup wizard.

### Services Started

| Service | Image | Port |
|---------|-------|------|
| `db` | postgres:16-alpine | 5432 (internal) |
| `server` | ghcr.io/axy-project/axyweb-server:latest | 3456 |
| `web` | ghcr.io/axy-project/axyweb-web:latest | 3457 |
| `watchtower` | containrrr/watchtower | — |

### Data Volumes

| Volume | Purpose |
|--------|---------|
| `pgdata` | PostgreSQL data |
| `projects` | Project files and uploads |

---

## Quick Install Script

The one-liner install script handles everything:

```bash
curl -fsSL https://raw.githubusercontent.com/Axy-Project/axy-claude-cli-web/main/scripts/install.sh | bash
```

This script:

1. Creates the `axy-web` directory
2. Downloads `docker-compose.prod.yml` and `.env.example`
3. Generates random secrets for `DB_PASSWORD` and `JWT_SECRET`
4. Runs `docker compose up -d`

---

## Dokploy / Coolify

### Option 1: Docker Compose (Recommended)

1. In your Dokploy or Coolify dashboard, create a new **Compose** service
2. Point to the repository: `https://github.com/Axy-Project/axy-claude-cli-web.git`
3. Set the compose file to `docker-compose.prod.yml`
4. Add environment variables in the panel:
   - `DB_PASSWORD` (required)
   - `JWT_SECRET` (required)
   - `CORS_ORIGINS` (set to your domain)
5. Deploy

### Option 2: Git Repository

1. Create a new project and point to the repo
2. Coolify/Dokploy will detect `docker-compose.yml` and build from source
3. Set environment variables as described above
4. Deploy

### Domain Configuration

After deployment, configure your domain:

- Point `axy.yourdomain.com` to port `3457` (frontend)
- If exposing the API separately, point `api.axy.yourdomain.com` to port `3456`
- Set `CORS_ORIGINS` to include your domain

---

## Manual Server Setup

For environments without Docker.

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 16 (or use SQLite for smaller deployments)
- Claude CLI installed

### Steps

```bash
# Clone repository
git clone https://github.com/Axy-Project/axy-claude-cli-web.git
cd AxyWeb

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
nano .env  # Set DATABASE_URL, JWT_SECRET, etc.

# Build
pnpm build

# Run database migrations
pnpm db:migrate

# Start (use a process manager like PM2 in production)
cd apps/server && node dist/index.js &
cd apps/web && npx next start --port 3457 &
```

### Using PM2

```bash
npm install -g pm2

# ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'axy-server',
      cwd: './apps/server',
      script: 'dist/index.js',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'axy-web',
      cwd: './apps/web',
      script: 'node_modules/.bin/next',
      args: 'start --port 3457',
      env: { NODE_ENV: 'production' },
    },
  ],
}
EOF

pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Auto-Updates with Watchtower

The production Docker Compose includes Watchtower, which automatically pulls new images and restarts containers.

### How It Works

- Watchtower checks for new images every **5 minutes** (300 seconds)
- Only updates containers with the `com.centurylinklabs.watchtower.enable=true` label
- Performs **rolling restarts** for zero-downtime updates
- Cleans up old images after update

### Configuration

Watchtower behavior is controlled via environment variables in `docker-compose.prod.yml`:

```yaml
watchtower:
  environment:
    WATCHTOWER_CLEANUP: "true"          # Remove old images
    WATCHTOWER_POLL_INTERVAL: 300       # Check every 5 minutes
    WATCHTOWER_LABEL_ENABLE: "true"     # Only update labeled containers
    WATCHTOWER_ROLLING_RESTART: "true"  # Zero-downtime restarts
```

### Manual Update

If you prefer manual updates:

```bash
docker compose pull
docker compose up -d
```

Or use the update script:

```bash
./scripts/update.sh
```

---

## Reverse Proxy

### Nginx

```nginx
server {
    listen 80;
    server_name axy.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name axy.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/axy.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/axy.yourdomain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3457;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API + WebSocket
    location /api/ {
        proxy_pass http://127.0.0.1:3456;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:3456;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

### Caddy

```
axy.yourdomain.com {
    # Frontend
    reverse_proxy localhost:3457

    # Backend API
    handle_path /api/* {
        reverse_proxy localhost:3456
    }

    # WebSocket
    handle /ws {
        reverse_proxy localhost:3456
    }
}
```

Caddy handles SSL automatically via Let's Encrypt.

### Important Notes

- Set `CORS_ORIGINS` to your domain (e.g., `https://axy.yourdomain.com`)
- WebSocket requires `Upgrade` and `Connection` headers to be proxied
- Increase proxy timeouts for long-running chat sessions

---

## SSL/TLS Setup

### Option 1: Caddy (Automatic)

Caddy automatically provisions and renews SSL certificates via Let's Encrypt. No configuration needed beyond the domain name.

### Option 2: Certbot (Nginx)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d axy.yourdomain.com

# Auto-renewal is configured automatically
sudo certbot renew --dry-run
```

### Option 3: Cloudflare Tunnel

If your server is behind a firewall or NAT:

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Authenticate and create tunnel
cloudflared tunnel login
cloudflared tunnel create axy-web
cloudflared tunnel route dns axy-web axy.yourdomain.com

# Run tunnel
cloudflared tunnel --url http://localhost:3457 run axy-web
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs server
docker compose logs web
docker compose logs db
```

### Database connection errors

```bash
# Verify PostgreSQL is healthy
docker compose exec db pg_isready -U axy

# Check DATABASE_URL format
# postgres://user:password@host:5432/database
```

### WebSocket connection failures

- Ensure your reverse proxy forwards `Upgrade` headers
- Check that `CORS_ORIGINS` includes your domain
- Verify port 3456 is accessible

### Claude CLI not found

- Ensure `claude` is installed and in PATH inside the Docker container
- Set `CLAUDE_PATH` if the binary is in a custom location
- Check `docker compose exec server which claude`

### Out of disk space

```bash
# Clean up Docker
docker system prune -a

# Check project volume size
docker compose exec server du -sh /data/projects
```
