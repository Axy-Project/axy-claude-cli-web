# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-03-20

### Added

#### Chat & AI
- Streaming chat with Claude CLI (tool calls, thinking blocks, artifacts)
- Agent system with 15+ pre-built templates and custom agent creation
- Agent orchestrator with built-in archetypes and automatic message routing
- Skill system with 45+ built-in skills across multiple categories
- Artifact preview for HTML, Markdown, Mermaid diagrams, and SVG
- Voice input and image/file upload in chat
- Session export in Markdown and JSON formats
- Slash commands and chat prefill from notes
- Session branching and forking with automatic git branch creation
- Diff viewer for code changes

#### Development Tools
- Monaco code editor with multi-tab editing and syntax highlighting
- Split terminal (xterm.js + node-pty) restricted to project directory
- Git panel with staging, commits, branches, merge, push, and pull
- GitHub integration for pull requests, issues, and actions
- MCP server management with Anthropic Registry browser and import
- Workspace snapshots via git tags (create, restore, diff)
- Commit message generation from staged changes

#### Project Management
- Multi-project support with CRUD operations
- Project upload (file and JSON-based)
- 7 project templates with scaffolding
- Organization and team support with roles (owner, admin, member)
- Task system with cron scheduling and background execution
- Notes system with project association
- Global search across projects, sessions, messages, and notes
- Command palette (Ctrl+K) and keyboard shortcuts
- Activity feed on dashboard
- Project config export and import

#### Deployment & Infrastructure
- SFTP deploy pipelines with auto-deploy on git push
- Ports panel with dev server management and reverse proxy
- Docker deployment with multi-stage Dockerfiles
- Docker Compose for production (pre-built images) and development
- Watchtower auto-updates with rolling restarts
- Health check endpoint with version comparison
- One-command install script

#### Auth & Security
- Setup wizard with built-in local authentication
- GitHub OAuth integration
- Dev login bypass for development
- JWT-based session management
- Rate limiting on API and auth endpoints
- Path validation with symlink safety
- CORS configuration

#### Platform
- Turborepo monorepo with pnpm workspaces
- Express 5 backend with WebSocket support
- Next.js 15 frontend with App Router and React 19
- Drizzle ORM with dual database support (SQLite dev / PostgreSQL prod)
- Connected accounts management (GitHub tokens, Claude API keys)
- Usage and cost dashboard with token tracking by model and day
- Structured JSON logging
- Responsive mobile layout
- Push notifications via Web Notifications API

[1.0.0]: https://github.com/Axy-Project/AxyWeb/releases/tag/v1.0.0
