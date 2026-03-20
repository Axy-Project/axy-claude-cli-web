# Axy Web Architecture

## Overview

Axy Web is a Turborepo monorepo that provides a full-featured web interface for interacting with the Claude CLI. It consists of a backend API server, a frontend web application, and a shared types package.

```
axy-web/
├── apps/
│   ├── server/              # Express 5 backend + WebSocket
│   └── web/                 # Next.js 15 frontend
├── packages/
│   └── shared/              # Shared TypeScript types
├── scripts/                 # Install, update, and utility scripts
├── logos/                   # Brand assets
├── docker-compose.yml       # Build from source
├── docker-compose.prod.yml  # Pre-built images + Watchtower
├── docker-compose.dev.yml   # Development overrides
├── turbo.json               # Turborepo pipeline config
├── pnpm-workspace.yaml      # pnpm workspace definition
└── VERSION                  # Current version (semver)
```

## Backend (`apps/server`)

### Stack

- **Runtime:** Node.js with TypeScript (via tsx in dev, compiled JS in prod)
- **Framework:** Express 5 (latest, with async route handlers)
- **WebSocket:** ws library for real-time communication
- **ORM:** Drizzle ORM with dual schema (SQLite for dev, PostgreSQL for prod)
- **Process management:** node-pty for terminal sessions, child_process for Claude CLI

### Entry Point

`src/index.ts` initializes Express, mounts all route modules, initializes the WebSocket manager, and starts the task scheduler.

### Route Architecture

All routes are mounted under `/api/` with rate limiting. Each domain has its own router file:

```
src/routes/
├── auth.router.ts          # GitHub OAuth + dev login
├── setup.router.ts         # Setup wizard (no auth)
├── claude-auth.router.ts   # Claude CLI auth management
├── projects.router.ts      # Project CRUD + upload
├── sessions.router.ts      # Session CRUD + branching
├── chat.router.ts          # Chat send/stop (streams via WS)
├── agents.router.ts        # Agent CRUD + catalog + orchestrator
├── skills.router.ts        # Skill CRUD + catalog
├── files.router.ts         # File read/write/create
├── git.router.ts           # Git operations (commit, push, branch, etc.)
├── github.router.ts        # GitHub API proxy (PRs, issues, actions)
├── deploy.router.ts        # SFTP deploy pipelines
├── mcp.router.ts           # MCP server management + registry
├── tasks.router.ts         # Task system + scheduling
├── notes.router.ts         # Notes CRUD
├── orgs.router.ts          # Organization management
├── accounts.router.ts      # Connected accounts (tokens)
├── ports.router.ts         # Dev server management + proxy
├── snapshots.router.ts     # Workspace snapshots (git tags)
├── templates.router.ts     # Project templates
├── search.router.ts        # Global search
├── activity.router.ts      # Activity feed
├── usage.router.ts         # Token usage stats
└── health.ts               # Health check + version
```

### Service Layer

Business logic is in `src/services/`, one file per domain:

```
src/services/
├── auth.service.ts         # GitHub OAuth flow, JWT generation
├── setup.service.ts        # Setup wizard, local auth
├── claude.service.ts       # Claude CLI process spawning + streaming
├── project.service.ts      # Project CRUD, file management
├── session.service.ts      # Session lifecycle, git branching
├── agent.service.ts        # Agent CRUD
├── orchestrator.service.ts # Built-in agents + message routing
├── skill.service.ts        # Skill CRUD
├── file.service.ts         # File operations with path validation
├── git.service.ts          # Git operations via simple-git
├── github.service.ts       # GitHub API via Octokit
├── deploy.service.ts       # SFTP deployment
├── mcp.service.ts          # MCP server config management
├── task.service.ts         # Task execution + cron scheduler
├── note.service.ts         # Notes CRUD
├── org.service.ts          # Organization management
├── account.service.ts      # Connected account token management
├── port.service.ts         # Dev server process management
├── snapshot.service.ts     # Git tag-based snapshots
├── templates.service.ts    # Project template scaffolding
├── terminal.service.ts     # node-pty terminal management
├── activity.service.ts     # Activity feed aggregation
└── stream-buffer.ts        # Chat stream buffering
```

### WebSocket System

The WebSocket layer (`src/ws/`) handles real-time communication:

- **Manager (`manager.ts`):** Handles connections, authentication, and routing
- **Broadcaster (`broadcaster.ts`):** Sends events to specific sessions or users

Events streamed via WebSocket:

| Event | Description |
|-------|-------------|
| `chat:stream` | Streaming tokens from Claude CLI |
| `chat:thinking` | Thinking block content |
| `chat:tool-call` | Tool call events |
| `chat:done` | Stream completion |
| `terminal:data` | Terminal output |
| `task:progress` | Task execution progress |

### Middleware

```
src/middleware/
├── auth.ts              # JWT verification, adds userId to request
├── cors.ts              # CORS configuration
├── rate-limit.ts        # Rate limiting (general + auth-specific)
├── request-logger.ts    # Structured JSON request logging
└── params.ts            # Express 5 param helper (string | string[])
```

### Database

Dual database support via Drizzle ORM:

- **Development:** SQLite via better-sqlite3 (zero configuration, stored at `axy-dev.db`)
- **Production:** PostgreSQL 16

Schema files:

```
src/db/
├── index.ts             # Database connection factory
├── schema.ts            # PostgreSQL schema
└── schema-sqlite.ts     # SQLite schema (integer timestamps, text JSON)
```

Key tables: `users`, `projects`, `sessions`, `messages`, `agents`, `skills`, `mcpServers`, `tasks`, `notes`, `organizations`, `orgMembers`, `connectedAccounts`, `deployPipelines`, `deployRuns`, `settings`.

### Claude CLI Integration

The `claude.service.ts` spawns Claude CLI as a child process:

1. Receives message via REST API (`POST /api/chat/send`)
2. Resolves agent context (built-in or custom)
3. Generates MCP config for the session
4. Spawns `claude` CLI with `--mcp-config` flag
5. Streams output via WebSocket to the client
6. Tracks token usage and persists messages to database

### Data Layout

```
data/
├── projects/
│   └── <userId>/
│       └── <projectId>/
│           └── <project-files>
├── budgets.json          # Budget configuration
└── plugins/              # Plugin manifests
```

## Frontend (`apps/web`)

### Stack

- **Framework:** Next.js 15 with App Router
- **UI:** React 19, Tailwind CSS 4, Lucide icons
- **State:** Zustand (8+ stores)
- **Editor:** Monaco Editor
- **Terminal:** xterm.js
- **Diagrams:** Mermaid
- **Markdown:** react-markdown with remark-gfm and rehype-sanitize

### Application Structure

```
src/
├── app/                     # Next.js App Router pages
│   ├── (auth)/              # Auth pages (login, callback, setup)
│   ├── (dashboard)/         # Main app pages
│   │   ├── projects/        # Project list and detail
│   │   ├── chat/            # Chat interface
│   │   ├── agents/          # Agent management
│   │   ├── skills/          # Skill management
│   │   ├── settings/        # Settings
│   │   └── ...
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Dashboard
├── components/              # React components
│   ├── chat/                # Chat UI (messages, input, artifacts)
│   ├── editor/              # Monaco editor wrapper
│   ├── terminal/            # xterm.js terminal
│   ├── git/                 # Git panel components
│   ├── ui/                  # Shared UI primitives
│   └── ...
├── lib/                     # Utilities
│   ├── api.ts               # API client (auto-unwraps responses)
│   ├── ws.ts                # WebSocket client with queue
│   └── ...
└── stores/                  # Zustand stores
    ├── auth-store.ts
    ├── project-store.ts
    ├── session-store.ts
    ├── chat-store.ts
    └── ...
```

### API Client

The API client (`lib/api.ts`) provides typed methods that auto-unwrap the `{ success, data }` envelope:

```typescript
const projects = await api.get<Project[]>('/projects')
const project = await api.post<Project>('/projects', { name: 'My Project' })
```

### WebSocket Client

The WebSocket client (`lib/ws.ts`) supports:

- Automatic reconnection
- Message queuing while disconnected (`sendQueued()`)
- Timeout-aware sending (`sendWhenReady()`)

## Shared Package (`packages/shared`)

Contains TypeScript types and interfaces shared between server and client:

- Entity types (Project, Session, Message, Agent, Skill, etc.)
- API request/response types
- Enums and constants
- Connected account types

## Authentication Flow

Axy supports two auth modes:

### Local Auth (Setup Wizard)

1. First visit redirects to `/setup`
2. User creates admin account (email + password)
3. Server hashes password with bcrypt, stores in `users` table
4. Returns JWT token
5. Subsequent logins via `POST /api/setup/login`

### GitHub OAuth

1. Client calls `POST /api/auth/login` to get OAuth URL
2. User authorizes on GitHub
3. GitHub redirects to callback with code
4. Client sends code to `POST /api/auth/callback`
5. Server exchanges code for token, creates/updates user
6. Returns JWT token

## Deploy Pipeline System

Deploy pipelines automate SFTP deployment:

1. **Configure:** Create pipeline with SFTP credentials and branch pattern
2. **Trigger:** Automatically triggered on git push (matching branch) or manually
3. **Execute:** Optionally runs pre-deploy command, then uploads via SFTP
4. **Notify:** Sends webhook notification (Slack, Discord, or custom URL)
5. **Track:** Records run history with status, duration, and logs

## Real-Time Communication

```
┌─────────┐    REST API     ┌──────────┐    Claude CLI    ┌─────────┐
│ Browser  │ ──────────────> │  Server  │ ──────────────> │ Claude  │
│          │ <────────────── │          │ <────────────── │  CLI    │
│          │   WebSocket     │          │    stdout       │         │
└─────────┘                  └──────────┘                  └─────────┘
```

1. Client sends chat message via REST API
2. Server spawns Claude CLI process
3. Claude CLI streams response to stdout
4. Server parses stream and broadcasts via WebSocket
5. Client renders tokens in real-time

## Ports

| Service | Default Port | Description |
|---------|-------------|-------------|
| Frontend | 3457 | Next.js web application |
| Backend | 3456 | Express API + WebSocket |
| PostgreSQL | 5432 | Database (Docker) |
