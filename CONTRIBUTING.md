# Contributing to Axy Web

Thank you for your interest in contributing to Axy Web. This document outlines how to set up the project for development, our code conventions, and the process for submitting changes.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Style](#code-style)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [License](#license)

---

## Development Setup

### Prerequisites

- **Node.js** 20 or later
- **pnpm** 10+ (`npm install -g pnpm`)
- **Claude CLI** installed and authenticated
- **Git** 2.30+

### Getting Started

```bash
# Clone the repository
git clone https://github.com/Axy-Project/AxyWeb.git
cd AxyWeb

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

This starts:

- **Backend** at `http://localhost:3456` (Express + WebSocket)
- **Frontend** at `http://localhost:3457` (Next.js)

### Database

Development uses SQLite by default (no setup required). The database file is created at `axy-dev.db` in the project root.

To use PostgreSQL in development:

```bash
# Start PostgreSQL (via Docker)
docker run -d --name axy-pg -e POSTGRES_DB=axy -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16-alpine

# Set DATABASE_URL in .env
echo 'DATABASE_URL=postgres://postgres:dev@localhost:5432/axy' >> .env
```

### Environment

Copy `.env.example` to `.env`. For development, the defaults work out of the box (SQLite, dev login, no external auth required).

---

## Project Structure

```
axy-web/
├── apps/
│   ├── server/          # Express 5 backend
│   │   └── src/
│   │       ├── routes/  # API route handlers
│   │       ├── services/ # Business logic
│   │       ├── db/      # Database schema + connection
│   │       ├── ws/      # WebSocket manager
│   │       ├── middleware/ # Auth, CORS, rate limiting
│   │       └── data/    # Catalogs (agents, skills)
│   └── web/             # Next.js 15 frontend
│       └── src/
│           ├── app/     # Pages (App Router)
│           ├── components/ # React components
│           ├── stores/  # Zustand state management
│           └── lib/     # Utilities (API client, WS)
├── packages/
│   └── shared/          # Shared TypeScript types
└── scripts/             # Deployment and utility scripts
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a detailed breakdown.

---

## Code Style

### General

- **TypeScript** throughout the entire codebase (zero tolerance for `any` where avoidable)
- **Zero errors** policy: both `apps/server` and `apps/web` must compile with zero TypeScript errors
- Use `const` by default, `let` only when reassignment is needed
- Prefer `async`/`await` over raw Promises

### Backend

- Express 5 route handlers are async
- Use the `param()` helper for Express 5 params (handles `string | string[]`)
- Services handle business logic; routes handle HTTP concerns only
- All responses use `{ success: true, data }` or `{ success: false, error }` format
- Structured JSON logging via the custom logger

### Frontend

- React 19 with functional components and hooks
- Zustand for state management (one store per domain)
- Tailwind CSS 4 for styling (no CSS modules or styled-components)
- Use `api.get<T>()` / `api.post<T>()` for API calls (auto-unwraps responses)
- Components are organized by feature, not by type

### Formatting

- 2-space indentation
- Single quotes for strings
- No semicolons (enforced by project config)
- Trailing commas in multiline structures

### Database

- SQLite schema uses integer timestamps and text for JSON columns
- PostgreSQL schema uses native timestamp and jsonb types
- Keep both schema files in sync when modifying tables

---

## Making Changes

### Branch Naming

```
feature/short-description
fix/issue-description
refactor/what-changed
docs/what-documented
```

### Commit Messages

Follow conventional commits:

```
feat: add new skill catalog category
fix: correct session branching on empty repos
refactor: extract git operations into service
docs: update API documentation for deploy endpoints
chore: update dependencies
```

### Testing Your Changes

```bash
# Type-check the entire monorepo
pnpm lint

# Type-check individual packages
pnpm --filter @axy/server lint
pnpm --filter @axy/web lint

# Build everything
pnpm build
```

Ensure:

1. TypeScript compiles with zero errors in all packages
2. The application starts and functions correctly
3. Both SQLite (dev) and PostgreSQL (prod) paths work if you touched DB code

---

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`
2. **Make your changes** following the code style guidelines
3. **Test** your changes locally (type-check, build, manual testing)
4. **Push** to your fork and open a pull request against `main`

### PR Requirements

- Clear title and description explaining what changed and why
- TypeScript compiles with zero errors
- No unrelated changes bundled in the same PR
- Breaking changes are clearly documented

### PR Description Template

```markdown
## Summary

Brief description of changes.

## Changes

- List of specific changes

## Testing

How you tested these changes.

## Screenshots

If applicable.
```

### Review Process

1. Maintainers will review within a few days
2. Address any feedback in follow-up commits
3. Once approved, the PR will be squash-merged into `main`
4. Docker images are automatically rebuilt on merge

---

## Issue Guidelines

### Bug Reports

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include:

- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, browser, Docker version)
- Relevant logs

### Feature Requests

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md). Include:

- Clear description of the problem or use case
- Proposed solution
- Alternatives considered

### Security Issues

Do **not** open public issues for security vulnerabilities. Email security concerns to the maintainers directly.

---

## License

By contributing to Axy Web, you agree that your contributions will be licensed under the [MIT License](LICENSE).
