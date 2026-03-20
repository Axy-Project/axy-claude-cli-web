# Axy Web API Reference

Base URL: `http://localhost:3456/api`

All responses follow the format:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

Authentication is via Bearer token in the `Authorization` header unless otherwise noted.

```
Authorization: Bearer <jwt-token>
```

---

## Table of Contents

- [Setup](#setup)
- [Auth](#auth)
- [Claude CLI Auth](#claude-cli-auth)
- [Projects](#projects)
- [Sessions](#sessions)
- [Chat](#chat)
- [Agents](#agents)
- [Skills](#skills)
- [Files](#files)
- [Git](#git)
- [GitHub](#github)
- [Deploy](#deploy)
- [MCP Servers](#mcp-servers)
- [Tasks](#tasks)
- [Notes](#notes)
- [Organizations](#organizations)
- [Accounts](#accounts)
- [Ports](#ports)
- [Snapshots](#snapshots)
- [Templates](#templates)
- [Search](#search)
- [Activity](#activity)
- [Usage](#usage)
- [Health](#health)
- [WebSocket](#websocket)

---

## Setup

Setup endpoints do **not** require authentication. They are used for initial configuration.

### Check Setup Status

```
GET /api/setup/status
```

Returns whether setup is complete and the configured auth method.

**Response:**

```json
{
  "success": true,
  "data": {
    "setupComplete": true,
    "authMethod": "local"
  }
}
```

### Initialize Admin Account

```
POST /api/setup/init
```

Creates the initial admin user. Only works once (returns 400 if setup is already complete).

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Admin email |
| `password` | string | Yes | Password (min 8 characters) |
| `displayName` | string | Yes | Display name |

**Response:** `201` with JWT token and user data.

### Login (Local Auth)

```
POST /api/setup/login
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Email address |
| `password` | string | Yes | Password |

**Response:** JWT token and user data.

---

## Auth

### GitHub OAuth Login

```
POST /api/auth/login
```

Returns a GitHub OAuth authorization URL.

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `redirectUrl` | string | No | Callback URL (defaults to origin + `/callback`) |

**Response:**

```json
{
  "success": true,
  "data": { "url": "https://github.com/login/oauth/authorize?..." }
}
```

### GitHub OAuth Callback

```
POST /api/auth/callback
```

Exchanges a GitHub OAuth code for a session.

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | GitHub OAuth authorization code |

### Get Current User

```
GET /api/auth/me
```

**Auth required.** Returns the authenticated user's profile.

### Dev Login

```
POST /api/auth/dev-login
```

Development-only endpoint. Returns a session without OAuth. Returns `403` in production.

### Logout

```
POST /api/auth/logout
```

**Auth required.** Logs out the current user.

---

## Claude CLI Auth

Manage Claude CLI authentication status and login flow.

### Check Claude Status

```
GET /api/claude/status
```

**Auth required.** Returns Claude CLI auth status, API key availability, and connected accounts.

**Response:**

```json
{
  "success": true,
  "data": {
    "hasApiKey": false,
    "hasEnvKey": true,
    "cliLoggedIn": true,
    "cliEmail": "user@example.com",
    "cliAuthMethod": "oauth",
    "cliSubscription": "pro",
    "cliInstalled": true,
    "accounts": []
  }
}
```

### Start CLI Login

```
POST /api/claude/login
```

**Auth required.** Starts an interactive Claude CLI login flow and returns an OAuth URL for browser authentication.

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `method` | string | No | `"claudeai"` or `"console"` |

---

## Projects

### List Projects

```
GET /api/projects
```

**Auth required.** Returns all projects for the authenticated user.

**Query params:** Supports filtering via query parameters.

### Get Project

```
GET /api/projects/:id
```

**Auth required.**

### Create Project

```
POST /api/projects
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Project name |
| `description` | string | No | Project description |
| `permissionMode` | string | No | `"default"` or other modes |

### Upload Project

```
POST /api/projects/upload
```

**Auth required.** Upload files as a new project (multipart form data, max 5000 files, 50MB per file).

**Form fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Project name |
| `description` | string | No | Description |
| `permissionMode` | string | No | Permission mode |
| `files` | File[] | Yes | Uploaded files |

### Upload Project (JSON)

```
POST /api/projects/upload-json
```

**Auth required.** Upload files as base64-encoded JSON.

### Update Project

```
PUT /api/projects/:id
```

**Auth required.**

### Delete Project

```
DELETE /api/projects/:id
```

**Auth required.**

### Get CLAUDE.md

```
GET /api/projects/:id/claude-md
```

**Auth required.** Returns the project's CLAUDE.md configuration file content.

### Update CLAUDE.md

```
PUT /api/projects/:id/claude-md
```

**Auth required.** Updates the project's CLAUDE.md configuration file.

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | New CLAUDE.md content |

### Export Project Config

```
GET /api/projects/:id/export
```

**Auth required.** Exports the project configuration (agents, skills, MCP servers, settings).

### Import Project Config

```
POST /api/projects/:id/import-config
```

**Auth required.** Imports a previously exported project configuration.

---

## Sessions

### List Sessions by Project

```
GET /api/sessions/project/:projectId
```

**Auth required.**

### Get Session

```
GET /api/sessions/:id
```

**Auth required.**

### Create Session

```
POST /api/sessions
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID |
| `title` | string | No | Session title |
| `model` | string | No | Claude model to use |

### Update Session

```
PATCH /api/sessions/:id
```

**Auth required.**

### Delete Session

```
DELETE /api/sessions/:id
```

**Auth required.**

### Bulk Delete Sessions

```
POST /api/sessions/bulk-delete
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ids` | string[] | Yes | Array of session IDs to delete |

### Branch Session

```
POST /api/sessions/:id/branch
```

**Auth required.** Creates a new git branch for the session.

### Get Session Messages

```
GET /api/sessions/:id/messages
```

**Auth required.** Returns all messages in a session.

### Get Stream Status

```
GET /api/sessions/:id/stream-status
```

**Auth required.** Returns the current streaming status for a session.

### Export Session

```
GET /api/sessions/:id/export
```

**Auth required.** Exports the session as Markdown or JSON.

---

## Chat

### Send Message

```
POST /api/chat/send
```

**Auth required.** Sends a message to Claude CLI. The response is streamed via WebSocket.

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | Session ID |
| `content` | string | Yes | Message content |
| `mode` | string | No | Chat mode |
| `agentId` | string | No | Agent ID (built-in or custom) |
| `images` | object[] | No | Base64-encoded images (`{ data, mimeType, name }`) |
| `effort` | string | No | Effort level for thinking |

### Stop Generation

```
POST /api/chat/stop
```

**Auth required.** Stops the current Claude CLI generation.

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | Session ID |

---

## Agents

### Get Agent Catalog

```
GET /api/agents/catalog
```

**Auth required.** Returns the full pre-built agent catalog with categories.

### Import Catalog Agent

```
POST /api/agents/import/:catalogId
```

**Auth required.** Imports a catalog agent as a custom user agent.

### Get Built-in Agents

```
GET /api/agents/built-in
```

**Auth required.** Returns built-in agent archetypes (orchestrator agents).

### Analyze Message for Agent Routing

```
POST /api/agents/analyze
```

**Auth required.** Analyzes a message and suggests agent routing.

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Message to analyze |
| `projectId` | string | No | Project context |
| `sessionId` | string | No | Session context |

### List User Agents

```
GET /api/agents
```

**Auth required.**

### Get Agent Hierarchy

```
GET /api/agents/hierarchy
```

**Auth required.** Returns agents organized hierarchically.

### Get Agent

```
GET /api/agents/:id
```

**Auth required.**

### Create Agent

```
POST /api/agents
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Agent name |
| `description` | string | No | Description |
| `role` | string | No | Agent role |
| `model` | string | No | Claude model |
| `systemPrompt` | string | No | System prompt |
| `allowedToolsJson` | string[] | No | Allowed tools |
| `disallowedToolsJson` | string[] | No | Disallowed tools |
| `extendedThinking` | boolean | No | Enable extended thinking |
| `thinkingBudget` | number | No | Thinking token budget |

### Update Agent

```
PUT /api/agents/:id
```

**Auth required.**

### Delete Agent

```
DELETE /api/agents/:id
```

**Auth required.**

---

## Skills

### Get Skill Catalog

```
GET /api/skills/catalog
```

**Auth required.** Returns the full built-in skill catalog (45+ skills).

### Get Catalog Skill

```
GET /api/skills/catalog/:id
```

**Auth required.** Returns a single skill from the catalog.

### Import Catalog Skill

```
POST /api/skills/import/:catalogId
```

**Auth required.** Imports a catalog skill as a custom user skill.

### List User Skills

```
GET /api/skills
```

**Auth required.**

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `orgId` | string | Filter by organization |

### Get Skill

```
GET /api/skills/:id
```

**Auth required.**

### Create Skill

```
POST /api/skills
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Skill name |
| `description` | string | No | Description |
| `trigger` | string | Yes | Trigger pattern (slash command) |
| `promptTemplate` | string | Yes | Prompt template |
| `category` | string | No | Category |
| `isGlobal` | boolean | No | Available globally |

### Update Skill

```
PUT /api/skills/:id
```

**Auth required.**

### Delete Skill

```
DELETE /api/skills/:id
```

**Auth required.**

---

## Files

### Get File Tree

```
GET /api/files/projects/:projectId
```

**Auth required.** Returns the directory tree for a project.

### Read File

```
GET /api/files/projects/:projectId/read?path=<relative-path>
```

**Auth required.** Reads a file from the project directory.

### Write File

```
PUT /api/files/projects/:projectId/write
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | Yes | Relative file path |
| `content` | string | Yes | File content |

### Create File or Directory

```
POST /api/files/projects/:projectId
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | Yes | Relative path |
| `type` | string | No | `"file"` or `"directory"` |
| `content` | string | No | Initial content (for files) |

---

## Git

All git endpoints require authentication and operate on a project's local repository.

### Clone Repository

```
POST /api/git/clone
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `repoUrl` | string | Yes | Git repository URL |
| `projectId` | string | Yes | Target project ID |
| `branch` | string | No | Branch to checkout |

### Get Status

```
GET /api/git/projects/:projectId/status
```

### Get Branches

```
GET /api/git/projects/:projectId/branches
```

### Checkout Branch

```
POST /api/git/projects/:projectId/checkout
```

**Body:** `{ "branch": "branch-name" }`

### Merge Branch

```
POST /api/git/projects/:projectId/merge
```

### Commit Changes

```
POST /api/git/projects/:projectId/commit
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Commit message |

### Push

```
POST /api/git/projects/:projectId/push
```

### Pull

```
POST /api/git/projects/:projectId/pull
```

### Discard Changes

```
POST /api/git/projects/:projectId/discard
```

### Link Remote Repository

```
POST /api/git/projects/:projectId/link-repo
```

### Fetch

```
POST /api/git/projects/:projectId/fetch
```

### Stage Files

```
POST /api/git/projects/:projectId/stage
```

### Unstage Files

```
POST /api/git/projects/:projectId/unstage
```

### Create Branch

```
POST /api/git/projects/:projectId/create-branch
```

### Generate Commit Message

```
POST /api/git/projects/:projectId/generate-message
```

Generates a commit message based on staged changes.

### Get Log

```
GET /api/git/projects/:projectId/log
```

### Get Diff

```
GET /api/git/projects/:projectId/diff
```

---

## GitHub

All GitHub endpoints require authentication and a connected GitHub account.

### List User Repos

```
GET /api/github/repos
```

### Search Repos

```
GET /api/github/repos/search
```

### Create Repo

```
POST /api/github/repos
```

### Get Repo

```
GET /api/github/repos/:owner/:repo
```

### Get Repo Branches

```
GET /api/github/repos/:owner/:repo/branches
```

### List PRs (by owner/repo)

```
GET /api/github/repos/:owner/:repo/prs
```

### Create PR (by owner/repo)

```
POST /api/github/repos/:owner/:repo/prs
```

### Create PR (by project)

```
POST /api/github/repos/create-pr
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID |
| `title` | string | Yes | PR title |
| `body` | string | No | PR description |
| `head` | string | Yes | Head branch |
| `base` | string | Yes | Base branch |

### Get PR Details

```
GET /api/github/repos/:projectId/prs/:prNumber
```

### Merge PR

```
POST /api/github/repos/:projectId/prs/:prNumber/merge
```

### List PRs (by project)

```
GET /api/github/repos/:projectId/prs
```

### List Issues (by owner/repo)

```
GET /api/github/repos/:owner/:repo/issues
```

### List Issues (by project)

```
GET /api/github/repos/:projectId/issues
```

### Create Issue

```
POST /api/github/repos/:projectId/issues
```

### List Actions/Workflows

```
GET /api/github/repos/:projectId/actions
```

### List User Organizations

```
GET /api/github/orgs
```

---

## Deploy

### List Pipelines

```
GET /api/deploy/projects/:projectId/pipelines
```

**Auth required.**

### Create Pipeline

```
POST /api/deploy/projects/:projectId/pipelines
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Pipeline name |
| `branchPattern` | string | Yes | Branch pattern to match |
| `sftpHost` | string | Yes | SFTP server host |
| `sftpPort` | number | No | SFTP port (default 22) |
| `sftpUsername` | string | Yes | SFTP username |
| `sftpPassword` | string | Cond. | Password (if no private key) |
| `sftpPrivateKey` | string | Cond. | SSH private key (if no password) |
| `sftpRemotePath` | string | Yes | Remote deployment path |
| `sftpSourcePath` | string | No | Source directory to deploy |
| `preDeployCommand` | string | No | Command to run before deploy |
| `webhookUrl` | string | No | Notification webhook URL |
| `webhookType` | string | No | Webhook type |

### Update Pipeline

```
PUT /api/deploy/pipelines/:pipelineId
```

**Auth required.**

### Delete Pipeline

```
DELETE /api/deploy/pipelines/:pipelineId
```

**Auth required.**

### Trigger Pipeline

```
POST /api/deploy/pipelines/:pipelineId/trigger
```

**Auth required.** Manually triggers a deployment.

### List Deployment Runs

```
GET /api/deploy/projects/:projectId/runs
```

**Auth required.**

---

## MCP Servers

Manage Model Context Protocol servers for projects.

### Browse Registry

```
GET /api/mcp/registry/browse?search=<query>&cursor=<cursor>
```

**Auth required.** Browse the Anthropic MCP server registry.

### Import from Registry

```
POST /api/mcp/registry/import
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Target project |
| `serverName` | string | Yes | Server identifier |
| `displayName` | string | Yes | Display name |
| `command` | string | No | Server command |
| `argsJson` | string[] | No | Command arguments |
| `envJson` | object | No | Environment variables |
| `remoteUrl` | string | No | Remote server URL |
| `transportType` | string | No | `"sse"` or `"streamable-http"` |

### List Project MCP Servers

```
GET /api/mcp/project/:projectId
```

**Auth required.**

### Get Project MCP Config

```
GET /api/mcp/project/:projectId/config
```

**Auth required.** Returns the generated MCP configuration JSON.

### Get MCP Server

```
GET /api/mcp/:id
```

**Auth required.**

### Create MCP Server

```
POST /api/mcp
```

**Auth required.**

### Update MCP Server

```
PUT /api/mcp/:id
```

**Auth required.**

### Delete MCP Server

```
DELETE /api/mcp/:id
```

**Auth required.**

---

## Tasks

### List Tasks

```
GET /api/tasks?projectId=<id>
GET /api/tasks?sessionId=<id>
```

**Auth required.** One of `projectId` or `sessionId` is required.

### Get Task

```
GET /api/tasks/:id
```

**Auth required.**

### Create Task

```
POST /api/tasks
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID |
| `title` | string | Yes | Task title |
| `sessionId` | string | No | Linked session |
| `type` | string | No | Task type |
| `description` | string | No | Description |
| `command` | string | No | Command to execute |
| `metadataJson` | object | No | Additional metadata |

### Update Task

```
PUT /api/tasks/:id
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | Task status |
| `result` | string | No | Task result |
| `error` | string | No | Error message |
| `progress` | number | No | Progress (0-100) |

### Schedule Task

```
POST /api/tasks/schedule
```

**Auth required.** Creates a task with cron scheduling.

### Cancel Task

```
POST /api/tasks/:id/cancel
```

**Auth required.**

### Delete Task

```
DELETE /api/tasks/:id
```

**Auth required.**

---

## Notes

### List Notes

```
GET /api/notes?projectId=<id>
```

**Auth required.** Lists notes, optionally filtered by project.

### Get Note

```
GET /api/notes/:id
```

**Auth required.**

### Create Note

```
POST /api/notes
```

**Auth required.**

### Update Note

```
PATCH /api/notes/:id
```

**Auth required.**

### Delete Note

```
DELETE /api/notes/:id
```

**Auth required.**

---

## Organizations

### List Organizations

```
GET /api/orgs
```

**Auth required.**

### Get Organization

```
GET /api/orgs/:id
```

**Auth required.**

### Create Organization

```
POST /api/orgs
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Organization name |
| `slug` | string | Yes | URL-safe slug |

### Update Organization

```
PUT /api/orgs/:id
```

**Auth required.** Requires `owner` or `admin` role.

### List Members

```
GET /api/orgs/:id/members
```

**Auth required.**

### Add Member

```
POST /api/orgs/:id/members
```

**Auth required.** Requires `owner` or `admin` role.

### Remove Member

```
DELETE /api/orgs/:id/members/:userId
```

**Auth required.** Requires `owner` or `admin` role.

---

## Accounts

Manage connected accounts (GitHub tokens, Claude API keys).

### List Accounts

```
GET /api/accounts?type=github|claude_api_key
```

**Auth required.**

### Create Account

```
POST /api/accounts
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `"github"` or `"claude_api_key"` |
| `nickname` | string | Yes | Display name |
| `token` | string | Yes | Token/API key |
| `username` | string | No | Associated username |
| `isDefault` | boolean | No | Set as default account |

### Update Account

```
PUT /api/accounts/:id
```

**Auth required.**

### Delete Account

```
DELETE /api/accounts/:id
```

**Auth required.**

### Test Account Connectivity

```
POST /api/accounts/:id/test
```

**Auth required.** Tests whether the stored token is valid.

---

## Ports

### List Open Ports

```
GET /api/ports
```

**Auth required.**

### Get Project Dev Scripts

```
GET /api/ports/project/:projectId/scripts
```

**Auth required.** Returns available npm/pnpm/yarn scripts and detected package manager.

### Start Dev Server

```
POST /api/ports/project/:projectId/start
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `script` | string | Yes | Script name to run |

### Stop Dev Server

```
POST /api/ports/project/:projectId/stop
```

**Auth required.**

### Get Dev Server Status

```
GET /api/ports/project/:projectId/status
```

**Auth required.**

### Check Port

```
GET /api/ports/:port/check
```

**Auth required.** Checks if a specific port is open.

---

## Snapshots

Workspace snapshots use git tags to save and restore project state.

### List Snapshots

```
GET /api/snapshots/project/:projectId
```

**Auth required.**

### Create Snapshot

```
POST /api/snapshots/project/:projectId
```

**Auth required.**

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Snapshot name |
| `description` | string | No | Description |

### Restore Snapshot

```
POST /api/snapshots/project/:projectId/restore/:snapshotId
```

**Auth required.** Restores the project to the snapshot state on a new branch.

### Delete Snapshot

```
DELETE /api/snapshots/project/:projectId/:snapshotId
```

**Auth required.**

---

## Templates

### List Templates

```
GET /api/templates
```

**Auth required.** Returns all available project templates (7 presets).

### Get Template

```
GET /api/templates/:id
```

**Auth required.**

### Apply Template

```
POST /api/templates/apply
```

**Auth required.** Applies a template to an existing project.

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Target project |
| `templateId` | string | Yes | Template to apply |

---

## Search

### Global Search

```
GET /api/search?q=<query>&type=all|projects|sessions|messages|notes
```

**Auth required.** Searches across projects, sessions, messages, and notes. Query must be at least 2 characters.

---

## Activity

### Get Activity Feed

```
GET /api/activity?limit=30
```

**Auth required.** Returns recent activity (max 100 items).

---

## Usage

### Get Usage Summary

```
GET /api/usage/summary
```

**Auth required.** Returns total and daily token usage and session counts.

### Usage by Model

```
GET /api/usage/by-model
```

**Auth required.** Token usage breakdown by Claude model.

### Usage by Day

```
GET /api/usage/by-day?days=30
```

**Auth required.** Daily usage over the last N days.

---

## Health

Health endpoints do **not** require authentication.

### Health Check

```
GET /api/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600
}
```

### Version Check

```
GET /api/health/version
```

Compares the running version against the latest version on GitHub.

**Response:**

```json
{
  "current": "1.0.0",
  "latest": "1.0.1",
  "updateAvailable": true
}
```

---

## WebSocket

Connect to the WebSocket server for real-time updates:

```
ws://localhost:3456/ws
```

The WebSocket delivers:

- **Chat stream events** (assistant messages, tool calls, thinking blocks, tokens)
- **Terminal output** (xterm.js data)
- **Task progress** updates
- **Dev server** logs and status changes

Messages are JSON-encoded. Authentication is performed via a token message after connection.
