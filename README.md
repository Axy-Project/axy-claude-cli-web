# Axy Web

Full-featured web interface for Claude CLI. Chat with AI, manage projects, deploy via SFTP, and more — all from your browser.

## Quick Deploy (Docker)

```bash
# 1. Clone
git clone https://github.com/Axy-Project/AxyWeb.git
cd AxyWeb

# 2. Configure
cp .env.example .env
# Edit .env with your keys (see below)

# 3. Deploy
docker compose up -d
```

Open `http://localhost:3457`

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `JWT_SECRET` | Yes | Secret for JWT tokens (random string) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | No | Supabase service role key |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth app secret |
| `CORS_ORIGINS` | No | Allowed origins (default: http://localhost:3457) |

## Deploy to Dokploy / Coolify

### Option 1: Docker Compose (recommended)

1. In Dokploy/Coolify, create a new **Compose** project
2. Point to this repo: `https://github.com/Axy-Project/AxyWeb.git`
3. Set environment variables in the panel
4. Deploy

### Option 2: Manual

```bash
git clone https://github.com/Axy-Project/AxyWeb.git
cd AxyWeb
cp .env.example .env
# Edit .env
docker compose up -d
```

## Update

```bash
./scripts/update.sh
```

Or manually:
```bash
git pull origin main
docker compose build --no-cache
docker compose up -d
```

## Development

```bash
pnpm install
pnpm dev  # starts both server (3456) and web (3457)
```

## Architecture

```
apps/
├── server/    Express 5 + WebSocket (port 3456)
└── web/       Next.js 15 (port 3457)
packages/
└── shared/    Shared TypeScript types
```

## Features

- Chat with Claude CLI (streaming, tool calls, thinking blocks)
- Multi-project management with GitHub integration
- Agent system (15+ templates)
- Skill system (45+ built-in skills)
- Split terminal (xterm.js) in chat view
- Git panel with PRs via GitHub API
- Deploy pipelines (SFTP auto-deploy)
- Monaco code editor
- MCP server management
- Organization & team support
- Auto-push to GitHub & auto-deploy on change

## License

Private - Axy Project
