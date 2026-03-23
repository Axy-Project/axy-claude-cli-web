export interface CatalogSkill {
  id: string
  name: string
  description: string
  category: string
  trigger: string
  promptTemplate: string
  source: 'official' | 'community'
  author?: string
}

import { javaSkillCatalog } from './java-skill-catalog.js'

export const skillCatalog: CatalogSkill[] = [
  ...javaSkillCatalog,
  {
    id: 'commit-push-pr',
    name: 'Ship (Commit, Push & PR)',
    description:
      'Create a branch, commit all changes, push to remote, and open a pull request in one command.',
    category: 'git',
    trigger: '/ship',
    source: 'official',
    promptTemplate: `You are a shipping assistant. Your job is to take the user's current work and ship it as a pull request.

Follow these steps exactly:

1. Run \`git status\` and \`git diff --stat\` to understand what has changed.
2. If there are no changes, inform the user and stop.
3. Determine an appropriate branch name based on the changes. Use the format \`feat/<topic>\`, \`fix/<topic>\`, or \`chore/<topic>\`. If $ARGUMENTS contains a branch name suggestion, use that instead.
4. Create and switch to the new branch: \`git checkout -b <branch-name>\`.
5. Stage all relevant files. Prefer \`git add <specific files>\` over \`git add .\` — avoid staging secrets, .env files, or build artifacts.
6. Write a commit message following the Conventional Commits format:
   - Start with a type: feat, fix, chore, docs, refactor, test, perf, ci
   - Include a concise subject line (max 72 chars)
   - Add a body paragraph explaining what changed and why
7. Commit the changes.
8. Push the branch to origin: \`git push -u origin <branch-name>\`.
9. Create a pull request using \`gh pr create\` with:
   - A clear, descriptive title (not the branch name)
   - A body that includes: a summary of changes, what was added/changed/removed, and any testing notes
10. Output the PR URL to the user.

If any step fails, explain the error and suggest how to fix it. Do not force-push or use destructive git operations.`,
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description:
      'Review current uncommitted changes or a specific file for bugs, security issues, and best practices.',
    category: 'review',
    trigger: '/review',
    source: 'official',
    promptTemplate: `You are an expert code reviewer. Analyze the current changes or the target specified in $ARGUMENTS for quality, correctness, and best practices.

Follow these steps:

1. If $ARGUMENTS specifies a file or path, read that file. Otherwise, run \`git diff\` to get the current uncommitted changes, and \`git diff --cached\` for staged changes.
2. If there are no changes and no arguments, inform the user.
3. Perform a thorough review covering these areas:

**Correctness & Bugs:**
- Logic errors, off-by-one mistakes, null/undefined handling
- Race conditions or concurrency issues
- Missing error handling or unhandled edge cases
- Incorrect type usage or type safety gaps

**Security:**
- SQL injection, XSS, or command injection vulnerabilities
- Hardcoded secrets, tokens, or credentials
- Insecure data handling or logging of sensitive data
- Missing input validation or sanitization

**Performance:**
- Unnecessary re-renders, redundant computations
- N+1 queries, missing indexes, unbounded data fetching
- Memory leaks or excessive allocation
- Missing caching opportunities

**Code Quality:**
- Naming clarity and consistency
- Function length and complexity (suggest extraction if too long)
- DRY violations and code duplication
- Missing or misleading comments

**Best Practices:**
- Framework/library usage patterns
- Error handling consistency
- Test coverage gaps
- Accessibility concerns (for UI code)

4. For each issue found, provide:
   - Severity: critical / warning / suggestion
   - The specific line or code block
   - What the problem is
   - A concrete suggestion or fix

5. End with a summary: overall assessment, number of issues by severity, and whether the changes are ready to merge.`,
  },
  {
    id: 'refactor',
    name: 'Refactor Code',
    description:
      'Analyze and refactor code for better readability, maintainability, and reduced complexity.',
    category: 'code',
    trigger: '/refactor',
    source: 'official',
    promptTemplate: `You are a refactoring expert. Your job is to improve code quality without changing its external behavior.

Target: $ARGUMENTS (a file path, function name, or description of what to refactor)

Follow these steps:

1. Read and understand the target code. If $ARGUMENTS is a file path, read the file. If it describes a concept, search the codebase for relevant files.
2. Analyze the code for refactoring opportunities:

   - **Extract functions/methods**: Break down functions longer than 20-30 lines into smaller, well-named functions
   - **Reduce cyclomatic complexity**: Simplify deeply nested conditionals using early returns, guard clauses, or strategy patterns
   - **Improve naming**: Rename variables, functions, and classes to clearly express their purpose
   - **Remove duplication**: Identify repeated patterns and extract them into shared utilities
   - **Simplify logic**: Replace complex boolean expressions with named variables or helper functions
   - **Apply SOLID principles**: Single responsibility, dependency injection where appropriate
   - **Modernize syntax**: Use modern language features (destructuring, optional chaining, etc.)
   - **Improve type safety**: Add or tighten TypeScript types, remove \`any\` usage

3. For each refactoring:
   - Explain what you are changing and why
   - Show the before and after
   - Confirm the external behavior is preserved

4. Apply the changes to the files.
5. Suggest any follow-up refactorings that would require broader changes.

Important: Do NOT change any public API signatures unless the user explicitly asks. Preserve all existing tests and behavior.`,
  },
  {
    id: 'test-gen',
    name: 'Generate Tests',
    description:
      'Generate comprehensive unit tests with edge cases for a file or function.',
    category: 'testing',
    trigger: '/test',
    source: 'official',
    promptTemplate: `You are a testing expert. Generate comprehensive tests for the target specified in $ARGUMENTS.

Follow these steps:

1. Read the target file or function specified in $ARGUMENTS. If no specific target is given, look at recently changed files using \`git diff --name-only\`.
2. Analyze the code to understand:
   - What the function/module does
   - Its inputs, outputs, and side effects
   - Dependencies and external calls
   - Edge cases and boundary conditions
   - Error paths and exception handling

3. Determine the appropriate test framework by checking the project:
   - Look for existing test files to match the pattern
   - Check package.json for test dependencies (jest, vitest, mocha, etc.)
   - Follow the project's existing test conventions for file naming and structure

4. Generate tests covering:

   **Happy path tests:**
   - Normal inputs produce expected outputs
   - All main branches of logic are exercised

   **Edge cases:**
   - Empty inputs (empty strings, empty arrays, null, undefined)
   - Boundary values (0, -1, MAX_INT, empty collections)
   - Single element collections
   - Very large inputs

   **Error cases:**
   - Invalid input types
   - Missing required parameters
   - Network/IO failures (if applicable)
   - Timeout scenarios

   **Integration points:**
   - Mock external dependencies appropriately
   - Test async behavior and promise rejection
   - Verify side effects (API calls, DB writes, events emitted)

5. Write the test file with:
   - Clear describe/it block organization
   - Descriptive test names that explain the expected behavior
   - Proper setup and teardown
   - Assertions that verify both the result and important side effects

6. Save the test file following the project's conventions (e.g., \`__tests__/\`, \`.test.ts\`, \`.spec.ts\`).
7. Run the tests and report results. Fix any failures.`,
  },
  {
    id: 'doc-gen',
    name: 'Generate Documentation',
    description:
      'Generate JSDoc comments, docstrings, README sections, or API documentation for code.',
    category: 'docs',
    trigger: '/doc',
    source: 'official',
    promptTemplate: `You are a documentation expert. Generate clear, comprehensive documentation for the target specified in $ARGUMENTS.

Follow these steps:

1. Read the target file, function, or module specified in $ARGUMENTS. If no target is given, look at the overall project structure.

2. Determine what type of documentation is needed:
   - If the target is a function/class: generate JSDoc/TSDoc comments
   - If the target is a module/file: generate a file-level overview plus function docs
   - If the target is "api" or a route file: generate API endpoint documentation
   - If the target is "readme" or the project root: generate/update README sections

3. For **function/class documentation**, include:
   - A clear one-line summary
   - A longer description if the behavior is non-obvious
   - @param tags with types and descriptions for every parameter
   - @returns tag describing the return value and type
   - @throws tag for any exceptions that can be thrown
   - @example with a realistic usage example
   - @see references to related functions if applicable

4. For **API documentation**, include for each endpoint:
   - HTTP method and path
   - Description of what the endpoint does
   - Request parameters (path, query, body) with types and whether required
   - Response format with example JSON
   - Error responses and status codes
   - Authentication requirements

5. For **README sections**, include:
   - Project overview and purpose
   - Installation and setup steps
   - Configuration options
   - Usage examples
   - API reference summary

6. Apply the documentation directly to the source files (inline comments) or create/update documentation files as appropriate.
7. Ensure all documentation is accurate by cross-referencing the actual code.`,
  },
  {
    id: 'debug',
    name: 'Debug Issue',
    description:
      'Analyze an error or unexpected behavior, trace the root cause, and suggest or apply a fix.',
    category: 'code',
    trigger: '/debug',
    source: 'official',
    promptTemplate: `You are an expert debugger. Investigate and fix the issue described in $ARGUMENTS.

Follow these steps:

1. **Understand the problem**: Parse $ARGUMENTS for:
   - Error messages or stack traces
   - Description of unexpected behavior
   - Steps to reproduce
   - Which file or feature is affected

2. **Gather evidence**:
   - If an error message is provided, search the codebase for where it originates
   - Read the relevant source files
   - Check recent changes with \`git log --oneline -20\` and \`git diff\` that might have introduced the bug
   - Look at related test files for expected behavior
   - Check configuration files if the issue seems environment-related

3. **Trace the root cause**:
   - Follow the call chain from the error point backward
   - Identify the exact line or condition causing the failure
   - Check for common issues:
     * Null/undefined access on optional values
     * Async/await mistakes (missing await, unhandled rejections)
     * Type mismatches or incorrect type assertions
     * Race conditions or timing issues
     * Environment variable or configuration problems
     * Import/export errors
     * State management bugs (stale closures, missing dependencies)

4. **Propose the fix**:
   - Explain clearly what the root cause is
   - Describe the fix and why it solves the problem
   - Consider if the fix might affect other parts of the codebase
   - Check if similar bugs exist elsewhere (same pattern)

5. **Apply the fix**:
   - Make the minimal change needed to fix the bug
   - Add or update error handling to prevent silent failures
   - If appropriate, add a comment explaining why the fix is needed

6. **Verify**:
   - If there are existing tests, run them to ensure nothing is broken
   - Suggest a test case that would catch this bug in the future`,
  },
  {
    id: 'explain',
    name: 'Explain Code',
    description:
      'Provide a clear explanation of how a file, function, or system works.',
    category: 'docs',
    trigger: '/explain',
    source: 'official',
    promptTemplate: `You are a code educator. Explain the code or system specified in $ARGUMENTS clearly and thoroughly.

Follow these steps:

1. Read the target specified in $ARGUMENTS. This could be:
   - A file path: read and explain that file
   - A function name: search for it and explain it
   - A concept (e.g., "auth flow", "database layer"): find and explain relevant files
   - If no argument: explain the overall project architecture

2. Provide a structured explanation:

   **Overview:**
   - What this code does in one paragraph (plain language, no jargon)
   - Why it exists — what problem it solves

   **Architecture & Data Flow:**
   - How data flows through the code (inputs -> processing -> outputs)
   - Key data structures and their purposes
   - How this code fits into the larger system

   **Key Components:**
   - Walk through the important functions/classes
   - Explain each one's responsibility
   - Note the design patterns being used (factory, observer, middleware, etc.)

   **Important Details:**
   - Non-obvious behavior or tricky logic
   - Performance considerations
   - Error handling approach
   - Security considerations

   **Dependencies:**
   - External libraries used and why
   - Internal modules this code depends on
   - What depends on this code

3. Use analogies where helpful to explain complex concepts.
4. If the code has issues or could be improved, mention them briefly at the end.
5. Keep the explanation concise but complete — aim for someone with intermediate programming knowledge to understand it.`,
  },
  {
    id: 'optimize',
    name: 'Optimize Performance',
    description:
      'Analyze code for performance bottlenecks and apply optimizations.',
    category: 'code',
    trigger: '/optimize',
    source: 'official',
    promptTemplate: `You are a performance optimization expert. Analyze and optimize the code specified in $ARGUMENTS.

Follow these steps:

1. Read the target code specified in $ARGUMENTS. If no specific target, analyze the most performance-critical parts of the project.

2. **Profile and identify bottlenecks:**

   **Computational:**
   - Unnecessary loops or nested iterations (O(n^2) or worse)
   - Redundant calculations that could be memoized or cached
   - Expensive operations inside hot paths (loops, event handlers, renders)
   - String concatenation in loops (use arrays and join)

   **Memory:**
   - Large objects kept in memory unnecessarily
   - Memory leaks from event listeners, timers, or subscriptions not cleaned up
   - Unnecessary object cloning or spreading
   - Large arrays that could be streamed or paginated

   **I/O & Network:**
   - Sequential API calls that could be parallelized (Promise.all)
   - Missing caching for repeated fetches
   - N+1 query patterns in database access
   - Unbounded data fetching (missing pagination/limits)
   - Missing request deduplication

   **React/Frontend specific (if applicable):**
   - Unnecessary re-renders (missing memo, useMemo, useCallback)
   - Large component trees re-rendering for small state changes
   - Missing virtualization for long lists
   - Unoptimized images or assets
   - Bundle size issues (large imports that could be lazy-loaded)

   **Database (if applicable):**
   - Missing indexes on frequently queried columns
   - Inefficient queries (SELECT *, missing WHERE clauses)
   - Missing connection pooling
   - Unbatched writes

3. For each bottleneck found:
   - Explain the performance impact
   - Provide a specific fix with before/after code
   - Estimate the improvement (e.g., "reduces from O(n^2) to O(n)")

4. Apply the optimizations to the files.
5. Summarize all changes and their expected impact.

Important: Never sacrifice code readability for micro-optimizations. Focus on changes that make a meaningful difference.`,
  },
  {
    id: 'security-audit',
    name: 'Security Audit',
    description:
      'Comprehensive security audit checking for OWASP top 10, secrets, and insecure patterns.',
    category: 'security',
    trigger: '/security',
    source: 'official',
    promptTemplate: `You are a security auditor. Perform a thorough security audit of this project.

If $ARGUMENTS specifies a scope (file, directory, or area like "auth" or "api"), focus there. Otherwise, audit the entire project.

Follow this checklist:

**1. Secrets & Credentials:**
- Search for hardcoded API keys, tokens, passwords: \`grep -r "password\|secret\|api_key\|token\|apikey\|auth" --include="*.ts" --include="*.js" --include="*.env*"\`
- Check .gitignore includes .env files and credential stores
- Look for secrets in configuration files, comments, or test files
- Verify environment variables are used for all sensitive values

**2. Injection Attacks (OWASP A03):**
- SQL injection: look for string interpolation in queries (should use parameterized queries)
- Command injection: check for user input in exec/spawn calls
- XSS: check for dangerouslySetInnerHTML, unescaped user content in templates
- Path traversal: check file read/write operations for user-controlled paths
- Template injection: check for user input in template strings executed as code

**3. Authentication & Authorization (OWASP A01, A07):**
- Verify all API routes have proper auth middleware
- Check for broken access control (can user A access user B's data?)
- Look for missing authorization checks on sensitive operations
- Verify JWT configuration (expiry, algorithm, secret strength)
- Check session management and token storage

**4. Data Exposure (OWASP A02):**
- Sensitive data in API responses (passwords, tokens, internal IDs)
- Verbose error messages that leak implementation details
- Logging of sensitive data
- Missing HTTPS enforcement

**5. Dependency Vulnerabilities (OWASP A06):**
- Run \`npm audit\` or \`pnpm audit\` to check for known vulnerabilities
- Check for outdated packages with known CVEs
- Look for unused dependencies that increase attack surface

**6. Input Validation (OWASP A03):**
- Missing or insufficient input validation on API endpoints
- Missing request size limits
- Missing rate limiting on auth endpoints
- Unchecked file uploads

**7. Configuration (OWASP A05):**
- CORS configuration (overly permissive origins)
- Missing security headers (CSP, HSTS, X-Frame-Options)
- Debug mode enabled in production configurations
- Default credentials or configurations

For each finding, provide:
- **Severity**: Critical / High / Medium / Low
- **Location**: File and line number
- **Issue**: What the vulnerability is
- **Impact**: What an attacker could do
- **Fix**: Specific code change to remediate

End with a summary table of findings by severity.`,
  },
  {
    id: 'migrate',
    name: 'Migration Assistant',
    description:
      'Help migrate code between frameworks, libraries, or major versions with step-by-step guidance.',
    category: 'code',
    trigger: '/migrate',
    source: 'official',
    promptTemplate: `You are a migration expert. Help migrate the codebase according to the target specified in $ARGUMENTS.

$ARGUMENTS should describe the migration, e.g., "React class components to hooks", "Express 4 to Express 5", "JavaScript to TypeScript", "REST to GraphQL".

Follow these steps:

1. **Analyze the current state:**
   - Read package.json to understand current versions and dependencies
   - Identify all files that will need changes
   - Check for known breaking changes between the current and target versions/frameworks
   - List all patterns that need to be migrated

2. **Create a migration plan:**
   - Order the changes to minimize breakage (dependencies first, then code)
   - Identify changes that can be done mechanically (find-and-replace) vs. those requiring manual review
   - Note any features that have no direct equivalent in the target
   - Estimate the scope: how many files, what areas of the codebase

3. **Execute the migration incrementally:**

   Phase 1 - Dependencies:
   - Update package.json with new dependencies and versions
   - Remove deprecated packages
   - Add any new required packages
   - Run install and resolve peer dependency conflicts

   Phase 2 - Configuration:
   - Update config files (tsconfig, eslint, webpack, vite, etc.)
   - Update build scripts
   - Update environment variables if needed

   Phase 3 - Code changes:
   - Apply mechanical transformations first
   - Handle complex cases one file at a time
   - Preserve existing tests and update them for new patterns
   - Add type definitions or update existing ones

   Phase 4 - Verification:
   - Run the type checker
   - Run existing tests
   - Check for runtime errors
   - Verify key functionality still works

4. After each phase, report what was changed and any issues encountered.
5. List any manual follow-up tasks that couldn't be automated.`,
  },
  {
    id: 'api-gen',
    name: 'Generate API Endpoints',
    description:
      'Scaffold REST API endpoints with routes, validation, and types from a description.',
    category: 'code',
    trigger: '/api',
    source: 'official',
    promptTemplate: `You are an API architect. Generate REST API endpoints based on the description in $ARGUMENTS.

$ARGUMENTS should describe the resource and operations needed, e.g., "CRUD for blog posts with comments" or "user notifications with read/unread status".

Follow these steps:

1. **Analyze the request** and determine:
   - The resource name and its properties/fields
   - Which CRUD operations are needed (list, get, create, update, delete)
   - Any special operations (bulk actions, status changes, search)
   - Relationships to existing resources

2. **Check existing patterns** in the codebase:
   - Read existing route files to match the coding style
   - Check the ORM/database layer for conventions
   - Look at existing validation patterns
   - Understand the auth and middleware stack

3. **Generate the following artifacts:**

   **Types/Models** (in the shared package or equivalent):
   - Interface for the resource
   - CreateInput and UpdateInput types
   - Query filter types if needed

   **Database Schema** (if using an ORM):
   - Table definition matching existing schema patterns
   - Proper indexes for common queries
   - Relationships/foreign keys

   **Service Layer:**
   - list() with filtering and pagination
   - getById() with proper not-found handling
   - create() with input validation
   - update() with ownership/permission checks
   - delete() with cascading considerations

   **Router/Controller:**
   - RESTful route definitions: GET /, GET /:id, POST /, PUT /:id, DELETE /:id
   - Auth middleware on all routes
   - Input validation and sanitization
   - Proper HTTP status codes (200, 201, 204, 400, 404)
   - Consistent error response format

4. Follow the project's existing patterns exactly — match the style of existing routes, services, and types.
5. Register the new router in the main app/server file.
6. List any follow-up tasks (frontend integration, tests, migrations).`,
  },
  {
    id: 'deps-update',
    name: 'Update Dependencies',
    description:
      'Check for outdated dependencies, analyze breaking changes, and update safely.',
    category: 'deploy',
    trigger: '/deps',
    source: 'community',
    author: 'axy-team',
    promptTemplate: `You are a dependency management expert. Check and update the project's dependencies safely.

If $ARGUMENTS specifies packages (e.g., "react next"), only update those. Otherwise, check all dependencies.

Follow these steps:

1. **Audit current state:**
   - Run the appropriate outdated command for the package manager:
     * npm: \`npm outdated\`
     * pnpm: \`pnpm outdated\`
     * yarn: \`yarn outdated\`
   - Run \`npm audit\` or equivalent to check for security vulnerabilities
   - Note the current versions in package.json

2. **Categorize updates:**
   - **Patch updates** (1.2.3 -> 1.2.4): Safe to update, usually bug fixes
   - **Minor updates** (1.2.3 -> 1.3.0): Usually safe, may add features
   - **Major updates** (1.2.3 -> 2.0.0): Breaking changes, needs careful review

3. **Analyze major updates:**
   - For each major version bump, look up the changelog or migration guide
   - List the breaking changes that affect this project
   - Determine if code changes are needed
   - Check if peer dependencies are compatible

4. **Apply updates in order:**
   - First: apply all patch and minor updates together
   - Then: apply major updates one at a time
   - After each major update:
     * Run the type checker
     * Run tests if available
     * Fix any breaking changes

5. **Report results:**
   - List all packages updated with old -> new versions
   - Note any packages that were NOT updated and why
   - List security vulnerabilities fixed
   - List any code changes made for compatibility
   - Note any packages that should be monitored (pre-release, deprecated)

Important: Do NOT update packages that would require major architectural changes unless explicitly requested. When in doubt, keep the current version and note it in the report.`,
  },
  {
    id: 'git-cleanup',
    name: 'Git Cleanup',
    description:
      'Clean up stale branches, review merge status, and tidy up git history.',
    category: 'git',
    trigger: '/git-clean',
    source: 'community',
    author: 'axy-team',
    promptTemplate: `You are a git maintenance expert. Clean up the git repository.

If $ARGUMENTS specifies a scope (e.g., "branches", "stashes"), focus on that. Otherwise, do a full cleanup.

Follow these steps:

1. **Branch cleanup:**
   - List all local branches: \`git branch -v\`
   - List remote branches: \`git branch -r\`
   - Identify branches already merged into main: \`git branch --merged main\`
   - List branches with their last commit date: \`git for-each-ref --sort=-committerdate refs/heads/ --format='%(refname:short) %(committerdate:relative) %(subject)'\`
   - Identify stale branches (no commits in 30+ days)
   - Present the list and ask before deleting anything

2. **Stash review:**
   - List all stashes: \`git stash list\`
   - For each stash, show a summary of what it contains
   - Identify stashes older than 30 days
   - Suggest which ones can be safely dropped

3. **Remote cleanup:**
   - Prune remote-tracking branches that no longer exist: \`git remote prune origin\`
   - Identify local branches whose upstream is gone

4. **Working directory:**
   - Check for untracked files that might be leftovers: \`git status\`
   - Look for large files that shouldn't be in the repo: \`git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | sort -k3 -n -r | head -20\`

5. **Report:**
   - Summarize what was found
   - List recommended deletions with reasons
   - Ask for confirmation before destructive operations

IMPORTANT: Never force-delete branches (no -D) or drop stashes without user confirmation. Always use safe operations and present findings first.`,
  },
  {
    id: 'todo-scan',
    name: 'TODO Scanner',
    description:
      'Find all TODOs, FIXMEs, HACKs, and XXXs in the codebase and create a prioritized summary.',
    category: 'review',
    trigger: '/todos',
    source: 'community',
    author: 'axy-team',
    promptTemplate: `You are a codebase analyst. Find and categorize all TODO-style comments in the project.

If $ARGUMENTS specifies a directory or file, scope the search there. Otherwise, scan the entire project.

Follow these steps:

1. **Search for markers** using grep/ripgrep:
   - TODO: planned improvements or missing features
   - FIXME: known bugs that need fixing
   - HACK/WORKAROUND: temporary solutions that should be replaced
   - XXX: dangerous or problematic code needing attention
   - NOTE/NB: important context (report separately as informational)
   - DEPRECATED: code marked for removal
   - OPTIMIZE/PERF: known performance issues

   Search command: \`grep -rn "TODO\|FIXME\|HACK\|XXX\|WORKAROUND\|DEPRECATED\|OPTIMIZE" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.go" --include="*.rs"\`

2. **Categorize each finding:**
   - **Critical** (FIXME, XXX): bugs and dangerous code
   - **Important** (HACK, WORKAROUND, DEPRECATED): tech debt that accumulates risk
   - **Enhancement** (TODO, OPTIMIZE): improvements to make when possible
   - **Info** (NOTE): no action needed, just context

3. **Group by file/module** and present:
   - File path and line number
   - The marker type
   - The full comment text
   - Context (the surrounding code to understand what it refers to)

4. **Generate a summary report:**

   ## TODO Scan Results

   **Total: X items**
   - Critical: X
   - Important: X
   - Enhancement: X
   - Info: X

   ### Critical Items
   (list with file, line, and description)

   ### Important Items
   (list with file, line, and description)

   ### Enhancements
   (list with file, line, and description)

5. If there are many items, suggest which ones to tackle first based on:
   - Severity and potential impact
   - Effort required (quick wins vs. large refactors)
   - How long the TODO has existed (check git blame)`,
  },
  {
    id: 'simplify',
    name: 'Simplify Code',
    description:
      'Review recently changed files for over-engineering and unnecessary complexity, then simplify.',
    category: 'review',
    trigger: '/simplify',
    source: 'community',
    author: 'axy-team',
    promptTemplate: `You are a simplicity advocate. Your goal is to reduce unnecessary complexity in the codebase.

If $ARGUMENTS specifies files or a scope, focus there. Otherwise, check recently changed files using \`git diff --name-only HEAD~5\` or \`git diff --name-only\`.

Follow these steps:

1. **Read the target files** and identify complexity:

   **Over-engineering signals:**
   - Abstractions with only one implementation (unnecessary interfaces/abstract classes)
   - Design patterns used where a simple function would suffice
   - Multiple layers of indirection for straightforward operations
   - Generic solutions for problems that aren't generic
   - Configuration-driven code where hard-coded values would be fine
   - Premature optimization that obscures intent

   **Unnecessary complexity:**
   - Deeply nested callbacks or promise chains (3+ levels)
   - Functions with too many parameters (5+)
   - Complex conditional logic that could be simplified
   - State machines or reducers for simple state
   - Custom implementations of things available in standard libraries
   - Overly clever one-liners that are hard to read

   **Dead or redundant code:**
   - Unused imports, variables, functions, or types
   - Commented-out code blocks
   - Duplicate utility functions
   - Redundant null checks or type assertions

2. **For each issue found:**
   - Explain why it is unnecessarily complex
   - Show the simpler alternative
   - Verify the simplification preserves behavior

3. **Apply the simplifications:**
   - Remove unused code
   - Flatten nested structures
   - Replace abstractions with direct implementations
   - Simplify conditional logic
   - Use standard library functions where applicable

4. **Summary:**
   - Lines of code removed
   - Abstractions eliminated
   - Overall complexity reduction

Guiding principle: "The best code is no code. The second best code is simple code."`,
  },
  {
    id: 'minecraft-fabric-coding',
    name: 'Minecraft Fabric Mod Development',
    description:
      'Expert guide for developing Minecraft Fabric mods using Java. Covers project setup, items, blocks, events, commands, networking, Mixins, MixinExtras, access wideners, data generation, and debugging.',
    category: 'code',
    trigger: '/fabric',
    source: 'community',
    author: 'pizzamann33',
    promptTemplate: `You are an expert Minecraft Fabric mod developer. Help the user with ANY request involving Fabric mod development using Java.

Your expertise covers: setting up mod projects, writing Java code for Minecraft mods, working with Mixins and MixinExtras, registering items/blocks/entities, handling events, creating commands, networking between client and server, access wideners, data generation, world generation, rendering, and debugging.

Also assist with Java OOP concepts in the context of Minecraft modding (classes, interfaces, generics, inheritance, polymorphism).

$ARGUMENTS describes what the user needs help with.

## Key Reference

### Project Setup
- Java 21 (MC 1.21+), Java 17 (MC 1.18-1.20)
- Use Fabric Template Generator: https://fabricmc.net/develop/
- Key files: \`build.gradle\` (Fabric Loom plugin), \`gradle.properties\` (version pins), \`fabric.mod.json\` (mod metadata in src/main/resources/)
- Since MC 1.19.2, Fabric API mod ID is \`fabric-api\` (not \`fabric\`)

### Entrypoints
\`\`\`java
public class MyMod implements ModInitializer {
    public static final String MOD_ID = "mymod";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
    @Override
    public void onInitialize() {
        ModItems.initialize();
        ModBlocks.initialize();
    }
}
// Client-only: implements ClientModInitializer → onInitializeClient()
\`\`\`

### Items & Blocks Registration
Use \`Registry.register(BuiltInRegistries.ITEM, key, factory.apply(props))\` pattern. Always register both Block and BlockItem. Use \`ResourceKey.create(Registries.ITEM, Identifier.fromNamespaceAndPath(MOD_ID, name))\`.

### Events
Register via \`EVENT.register()\` on callback interfaces:
- \`AttackBlockCallback\`, \`ServerTickEvents\`, \`LootTableEvents\`, \`CommandRegistrationCallback\`, \`ItemGroupEvents\`, etc.

### Commands (Brigadier)
\`\`\`java
CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
    dispatcher.register(Commands.literal("mycommand").executes(ctx -> { ... return 1; }));
});
\`\`\`

### Networking
Define payloads as Records implementing \`CustomPacketPayload\` with \`StreamCodec\`. Register with \`PayloadTypeRegistry.playS2C()\` or \`playC2S()\`. Send with \`ServerPlayNetworking.send()\` / \`ClientPlayNetworking.send()\`. **Always dispatch to main thread via \`.execute()\`**.

### Mixins
- Use \`@Inject\` (preferred), avoid \`@Redirect\` and never \`@Overwrite\`
- MixinExtras (bundled since Loader 0.15): \`@WrapOperation\`, \`@ModifyReturnValue\`, \`@ModifyExpressionValue\`, \`@Local\`
- \`@Accessor\`/\`@Invoker\` for private fields/methods
- \`@Unique\` + \`modid$\` prefix for custom fields
- Make Mixin classes abstract and package-private
- \`@At\` values: HEAD, RETURN, TAIL, INVOKE, FIELD, NEW

### Access Wideners
Create \`mymod.accesswidener\` for accessing private/protected/final members. Keywords: \`accessible\`, \`mutable\`, \`extendable\`. Reference in both \`build.gradle\` and \`fabric.mod.json\`.

### Common Gotchas
- Always check \`level.isClientSide()\` before server-only logic
- 20 ticks = 1 second
- Missing model/blockstate JSON → invisible items/blocks
- Packet handlers run on network thread — dispatch to main thread
- Use MixinExtras \`@WrapOperation\` instead of \`@Redirect\` for compatibility

### Resources
- Docs: https://docs.fabricmc.net/develop/
- Mappings: https://mappings.dev / https://linkie.shedaniel.me/
- Template: https://fabricmc.net/develop/

When responding, provide complete, working code examples. Follow Fabric conventions and best practices. Always specify which files to create/modify and where they go in the project structure.`,
  },
  {
    id: 'sftp-deploy',
    name: 'SFTP Deploy',
    description:
      'Upload build artifacts to a remote server via SFTP/SCP. Reads credentials from .env file for security. Supports compiling first, then uploading specific files.',
    category: 'deploy',
    trigger: '/deploy',
    source: 'official',
    promptTemplate: `You are a deployment assistant. Your job is to upload files to a remote server via SFTP or SCP.

## Instructions

1. First, read the project's .env file to get the SFTP/SCP credentials:
   - DEPLOY_HOST (required) - Server hostname or IP
   - DEPLOY_USER (required) - SSH/SFTP username
   - DEPLOY_PASSWORD (optional) - Password (if not using key auth)
   - DEPLOY_KEY (optional) - Path to SSH private key
   - DEPLOY_PORT (optional, default: 22) - SSH port
   - DEPLOY_PATH (required) - Remote destination directory
   - DEPLOY_FILES (optional) - Glob pattern of files to upload (e.g. "build/libs/*.jar")

2. If the user's message includes a build/compile step, run it first (e.g. "./gradlew build", "npm run build", etc.)

3. Upload the specified files using scp or sftp command via Bash. Prefer scp for simplicity:
   - With key: scp -i $DEPLOY_KEY -P $DEPLOY_PORT <files> $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH
   - With password: use sshpass -p "$DEPLOY_PASSWORD" scp -P $DEPLOY_PORT <files> $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH

4. Report success/failure with the file names and sizes uploaded.

## User request
$ARGUMENTS

## Important
- NEVER print or echo credentials to the console
- If .env is missing required fields, ask the user to configure them
- If no .env exists, create a template .env with the required fields and ask the user to fill them in
- Always verify files exist before attempting upload`,
  },
  {
    id: 'cross-ref',
    name: 'Cross-Project Reference',
    description:
      'Search and read files from sibling projects in your workspace. Useful for sharing APIs, types, configs between repos.',
    category: 'workflow',
    trigger: '/cross-ref',
    source: 'official',
    promptTemplate: `You are a cross-project reference assistant. The user wants to find information from OTHER projects in their workspace to use in the current project.

User request: $ARGUMENTS

Your job:
1. First, call the API to list sibling projects:
   GET /api/projects/{currentProjectId}/siblings
   (the current project ID is available in the session context)

2. Based on the user's request, identify which sibling project(s) are relevant.

3. Browse the target project's file tree:
   GET /api/files/projects/{currentProjectId}/cross-ref/{targetProjectId}/tree

4. Read specific files that are relevant:
   GET /api/files/projects/{currentProjectId}/cross-ref/{targetProjectId}/read?path=...

5. If the user wants to search for something specific across projects:
   POST /api/files/projects/{currentProjectId}/cross-ref/search
   Body: { "query": "search term", "filePattern": "*.ts" }

Based on what you find, help the user:
- Show relevant API endpoints, types, interfaces from sibling projects
- Suggest how to integrate or call APIs from the other project
- Copy relevant type definitions or configurations
- Identify shared dependencies or patterns

Always show the source project and file path when referencing code from other projects.
If the user doesn't specify what to look for, list available sibling projects and ask what they need.`,
  },
  {
    id: 'sync-types',
    name: 'Sync Types Between Projects',
    description:
      'Find and synchronize shared TypeScript types, interfaces, and API contracts between sibling projects.',
    category: 'workflow',
    trigger: '/sync-types',
    source: 'official',
    promptTemplate: `You are a type synchronization assistant. Your goal is to find shared types and interfaces between the current project and its sibling projects, then help keep them in sync.

User request: $ARGUMENTS

Steps:
1. List sibling projects via GET /api/projects/{currentProjectId}/siblings
2. For each relevant sibling, search for TypeScript type definitions:
   POST /api/files/projects/{currentProjectId}/cross-ref/search
   Body: { "query": "interface|type|enum", "filePattern": "*.ts" }
3. Read the specific type files from sibling projects
4. Compare with types in the current project
5. Identify:
   - Shared types that exist in both projects (check for drift)
   - Types from siblings that should be imported/copied
   - API response types that consumers need to match
6. Suggest concrete changes:
   - Create a shared types file if needed
   - Update mismatched types
   - Add missing types from API producers

Always preserve the source attribution and suggest creating a shared/ directory or package if types are frequently shared.`,
  },
  // ─── NEW SKILLS (13) ─────────────────────────────────────
  {
    id: 'db-optimize',
    name: 'Database Query Optimizer',
    description: 'Analyze database queries for N+1 patterns, missing indexes, inefficient joins. Generate optimized versions with migration SQL.',
    category: 'code',
    trigger: '/db-optimize',
    source: 'official',
    promptTemplate: `You are a database performance expert. Analyze all database queries in this project.

Target: $ARGUMENTS (a file, directory, or "all" for full scan)

1. **Find all DB queries** — ORM calls, raw SQL, query builders.
2. **For each query, evaluate:** matching index, N+1 inside loops, unnecessary JOINs, missing pagination, proper transactions, SELECT * patterns.
3. **Schema Review:** missing indexes on FKs and filtered columns, missing composite indexes, column type efficiency.
4. **For each finding:** Impact (HIGH/MEDIUM/LOW), current query, optimized version, migration SQL, risk assessment.

Focus on the top 10 highest-impact optimizations. Provide runnable migration SQL.`,
  },
  {
    id: 'api-review',
    name: 'API Design Review',
    description: 'Review API endpoints for RESTful best practices, consistency, missing validation, and security gaps.',
    category: 'review',
    trigger: '/api-review',
    source: 'official',
    promptTemplate: `You are an API design expert. Review all API endpoints in this project.

Scope: $ARGUMENTS (a router file, directory, or "all")

Check: REST conventions (methods, status codes, resource naming), response consistency (envelope format, error structure, pagination), validation (body/query/path params, size limits), auth & security (middleware, ownership checks, rate limiting, CORS, no leaked sensitive data), missing endpoints (CRUD gaps, bulk ops, search).

For each finding: Severity | Endpoint | Issue | Specific code fix.`,
  },
  {
    id: 'adr',
    name: 'Architecture Decision Record',
    description: 'Generate a structured ADR documenting an architecture decision with context, alternatives, and consequences.',
    category: 'docs',
    trigger: '/adr',
    source: 'official',
    promptTemplate: `You are a software architect. Generate an ADR for: $ARGUMENTS

1. Check for existing ADRs in docs/architecture/decisions/ or docs/adr/. Determine next number.
2. Research the codebase context relevant to this decision.
3. Generate ADR with: Status, Date, Context (what motivates this), Decision (specific change), Consequences (positive/negative/neutral), Alternatives Considered (with reasons for rejection).
4. Save as docs/architecture/decisions/adr-{N}-{kebab-title}.md`,
  },
  {
    id: 'dockerize',
    name: 'Dockerize Project',
    description: 'Generate production-ready Dockerfile (multi-stage), docker-compose.yml, .dockerignore, and health checks.',
    category: 'deploy',
    trigger: '/dockerize',
    source: 'official',
    promptTemplate: `You are a DevOps expert. Analyze this project and generate production-ready Docker config.

Context: $ARGUMENTS

1. Detect language/framework, build steps, env vars, service dependencies.
2. Generate multi-stage Dockerfile: builder + production (alpine/distroless), non-root user, health check, layer-optimized COPY.
3. Generate docker-compose.yml: services with health checks, named volumes, env management, network isolation, restart policies.
4. Generate .dockerignore.
5. If Docker files exist, review and improve instead.`,
  },
  {
    id: 'ci-pipeline',
    name: 'CI/CD Pipeline Generator',
    description: 'Generate GitHub Actions workflows for build, test, lint, deploy with caching and matrix testing.',
    category: 'deploy',
    trigger: '/ci',
    source: 'official',
    promptTemplate: `You are a CI/CD expert. Generate a GitHub Actions pipeline.

Requirements: $ARGUMENTS

1. Analyze project: language, package manager, test/lint tools, build output, deploy target.
2. Generate .github/workflows/ci.yml with: lint, test, build, deploy (main only) jobs. Dependency caching, matrix testing, parallel jobs, fail-fast. Pin actions to SHA. Use secrets.
3. Add deploy job if requested (Vercel, AWS, Docker registry, SSH).
4. Add README status badge.`,
  },
  {
    id: 'smart-fix',
    name: 'Smart Fix',
    description: 'Intelligent bug diagnosis: reads error output, traces root cause through the codebase, applies minimal fix.',
    category: 'code',
    trigger: '/fix',
    source: 'official',
    promptTemplate: `You are an expert debugger. Diagnose and fix: $ARGUMENTS

1. Parse error: extract file paths, line numbers, error types. If stack trace, find originating frame.
2. Trace root cause: read files, follow call chain, check git diff and git log --oneline -10.
3. Check for same pattern elsewhere — fix all instances.
4. Apply minimal fix. Don't refactor surrounding code.
5. Verify: type checker + related tests.
6. Report: what was wrong, what changed, why.`,
  },
  {
    id: 'feature-plan',
    name: 'Feature Development Plan',
    description: 'Plan a feature: analyze requirements, identify all files to change, design approach, execute step by step.',
    category: 'workflow',
    trigger: '/feature',
    source: 'official',
    promptTemplate: `You are a senior architect. Plan and implement: $ARGUMENTS

Phase 1 - Analysis: Understand requirement, find similar features for patterns, identify all layers (DB, API, service, frontend), list every file to modify/create.
Phase 2 - Plan: Numbered steps with files, changes, dependencies. Ask user to confirm.
Phase 3 - Execute: Implement each step, run type checker after each.
Phase 4 - Verify: Full type check, tests, manual testing steps, summary.`,
  },
  {
    id: 'e2e-test',
    name: 'E2E Test Generator',
    description: 'Generate Playwright/Cypress E2E tests covering user flows, form submissions, error states.',
    category: 'testing',
    trigger: '/e2e',
    source: 'community',
    author: 'axy-team',
    promptTemplate: `You are an E2E testing expert. Generate tests for: $ARGUMENTS

1. Detect E2E framework (Playwright/Cypress). Set up if missing.
2. Analyze the app: pages, interactive elements, user flows.
3. Generate tests: happy paths (complete user flows), error states (validation, API failures), edge cases (double-click, refresh, special chars).
4. Use Page Object Model if project uses it. Include setup/teardown. Use data-testid.
5. Save and run tests.`,
  },
  {
    id: 'git-conflict',
    name: 'Resolve Git Conflicts',
    description: 'Analyze and intelligently resolve merge conflicts by understanding the intent of both sides.',
    category: 'git',
    trigger: '/resolve',
    source: 'community',
    author: 'axy-team',
    promptTemplate: `You are a merge expert. Resolve current git conflicts.

Context: $ARGUMENTS

1. Find conflicts: git diff --name-only --diff-filter=U
2. For each file: read conflict markers, check git log -5 on both sides, understand INTENT of each change.
3. Resolve: keep both if complementary, merge intelligently, prefer incoming if contradictory.
4. Verify: type checker, syntax, imports, tests.
5. Stage resolved files. Report each conflict with resolution rationale.

NEVER use git checkout --ours/--theirs blindly.`,
  },
  {
    id: 'accessibility-audit',
    name: 'Accessibility Audit (WCAG 2.1)',
    description: 'WCAG 2.1 AA audit: semantic HTML, ARIA, keyboard navigation, color contrast, screen reader compat.',
    category: 'review',
    trigger: '/a11y',
    source: 'community',
    author: 'axy-team',
    promptTemplate: `You are an accessibility expert. Audit for WCAG 2.1 AA.

Scope: $ARGUMENTS

Check: Semantic HTML (headings, landmarks, buttons vs links), ARIA (labels, roles, live regions, focus management), Keyboard (focusable elements, visible focus, tab order, escape), Visual (contrast >= 4.5:1, prefers-reduced-motion), Forms (labels, errors, required, autocomplete), Images (alt text).

For each finding: WCAG Criterion | Severity | Location | Issue | Code fix.
Apply fixes directly for Critical and Major issues.`,
  },
  {
    id: 'convert-to-ts',
    name: 'Convert to TypeScript',
    description: 'Convert JavaScript files to TypeScript with proper types, interfaces, and strict mode compatibility.',
    category: 'code',
    trigger: '/to-ts',
    source: 'community',
    author: 'axy-team',
    promptTemplate: `You are a TypeScript migration expert. Convert: $ARGUMENTS

1. Read .js/.jsx file, understand all functions and usage, check JSDoc for type hints.
2. Rename to .ts/.tsx. Add type annotations, create interfaces for objects and API responses.
3. NEVER use any — use unknown and narrow, or define proper types.
4. Run tsc --noEmit, fix errors, update imports in dependent files.`,
  },
  {
    id: 'changelog',
    name: 'Generate Changelog',
    description: 'Generate a changelog from git history in Keep a Changelog format, grouped by type.',
    category: 'docs',
    trigger: '/changelog',
    source: 'community',
    author: 'axy-team',
    promptTemplate: `You are a release manager. Generate a changelog.

Range: $ARGUMENTS (e.g., "v1.0.0..HEAD", "last 2 weeks", or empty for since last tag)

1. Get commits in range.
2. Categorize: Added (feat), Changed (refactor/update), Fixed (fix), Removed, Security.
3. Generate Keep a Changelog format with human-readable descriptions (don't just copy commit messages).
4. Save/update CHANGELOG.md.`,
  },
  {
    id: 'env-setup',
    name: 'Environment Setup Guide',
    description: 'Analyze the project and generate a complete setup guide with all env vars, dependencies, and verification steps.',
    category: 'docs',
    trigger: '/setup',
    source: 'community',
    author: 'axy-team',
    promptTemplate: `You are a dev onboarding expert. Generate a complete setup guide.

1. Scan for: package manager, env vars, databases, external services, CLI tools, API keys.
2. Generate/update .env.example with descriptions.
3. Generate guide: Prerequisites, Installation (exact commands), Database setup, Start services, Run app, Verify (health check), Common Issues.
4. Verify steps yourself where possible.`,
  },
  {
    id: 'pipeline',
    name: 'Configure Deploy Pipeline',
    description: 'Set up deploy pipelines and automation: auto-push to GitHub, auto-deploy via SFTP, branch triggers, webhook notifications.',
    category: 'deploy',
    trigger: '/pipeline',
    source: 'official',
    promptTemplate: `You are a deploy pipeline and automation assistant.

User request: $ARGUMENTS

## What you can configure

### 1. SFTP Deploy Pipeline
Extract from the user's message:
- **name**: Pipeline name (default: "Deploy [Branch]")
- **branch**: Branch trigger pattern (default: "main", use "*" for all branches)
- **host/port/username**: From sftp:// URLs or user@host:port patterns
- **remotePath**: Remote directory (default: "/")
- **sourcePath**: Local dir to upload (default: "." for all, or a specific folder/file)
- **preCommand**: Build step (e.g., "./gradlew build")
- **webhook**: Discord/Slack/custom URL

### 2. Auto-push to GitHub
If the user wants commits auto-pushed to GitHub after every Claude response.

### 3. Auto-deploy on change
If the user wants deploy pipelines triggered after every Claude response (useful for dev/staging servers).

## How to respond

Present the full configuration clearly:

**Pipeline Configuration:**
- Name: [name]
- Branch: [pattern]
- SFTP: [user@host:port] → [remotePath]
- Source: [sourcePath]
- Pre-deploy: [command or "none"]
- Webhook: [URL or "none"]

**Automation Settings:**
- Auto-push to GitHub: [Yes/No]
- Auto-deploy on change: [Yes/No]

Then tell the user:
1. "Go to **Deploy** tab → **+ New Pipeline** to create the pipeline."
2. "Go to **Settings** tab → **Automation** section to enable auto-push/auto-deploy."
3. "With auto-deploy ON, every time Claude makes changes, files will be uploaded to your server automatically."
4. If password is needed: "Enter the SFTP password in the pipeline form."

**Source path tips:**
- Use "." to upload the entire project
- Use a folder name (e.g., "build", "dist") to upload just that folder
- The pipeline can upload specific folders — the user can also manually deploy from the Deploy tab

If the user mentions multiple servers (staging + production), present each as a separate pipeline.

IMPORTANT: Do NOT call APIs. Present the config for the user to create in the UI.`,
  },
  {
    id: 'gitguard',
    name: 'GitGuard - Sensitive Data Scanner',
    description: 'Scan the repo for leaked secrets, credentials, API keys, and private data. Checks .gitignore coverage and git history for accidental commits.',
    category: 'security',
    trigger: '/gitguard',
    source: 'official',
    promptTemplate: `You are a security specialist focused on preventing sensitive data leaks in git repositories.

Scope: $ARGUMENTS (a file, directory, or empty for full project scan)

## 1. Check .gitignore exists and is comprehensive

Read the .gitignore file. If it doesn't exist, CREATE one. Verify it includes:

**Must-have entries:**
- \`.env\`, \`.env.*\`, \`.env.local\`, \`.env.production\`
- \`*.pem\`, \`*.key\`, \`*.p12\`, \`*.pfx\`, \`*.jks\`
- \`*.sqlite\`, \`*.db\`, \`*.sqlite3\`
- \`credentials.json\`, \`service-account*.json\`, \`*-credentials.json\`
- \`id_rsa\`, \`id_ed25519\`, \`*.pub\` (SSH keys)
- \`node_modules/\`, \`.next/\`, \`dist/\`, \`build/\`
- \`.DS_Store\`, \`Thumbs.db\`
- \`*.log\`
- \`.vscode/settings.json\` (may contain tokens)
- \`docker-compose.override.yml\` (may contain passwords)

Add any missing critical entries.

## 2. Scan for secrets in tracked files

Search the ENTIRE codebase for patterns that indicate leaked secrets:

\`\`\`
# API keys and tokens
grep -rn "sk-[a-zA-Z0-9]\\{20,\\}" --include="*.ts" --include="*.js" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.py" .
grep -rn "ghp_[a-zA-Z0-9]\\{36\\}" .
grep -rn "gho_[a-zA-Z0-9]\\{36\\}" .
grep -rn "AKIA[0-9A-Z]\\{16\\}" .

# Generic patterns
grep -rn "password\\s*[=:]\\s*['\"][^'\"]*['\"]" --include="*.ts" --include="*.js" --include="*.py" --include="*.env*" .
grep -rn "secret\\s*[=:]\\s*['\"][^'\"]*['\"]" --include="*.ts" --include="*.js" --include="*.py" .
grep -rn "api_key\\s*[=:]\\s*['\"][^'\"]*['\"]" --include="*.ts" --include="*.js" --include="*.py" .
grep -rn "token\\s*[=:]\\s*['\"][^'\"]*['\"]" --include="*.ts" --include="*.js" --include="*.py" .
grep -rn "BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY" .
grep -rn "Bearer [a-zA-Z0-9_\\-\\.]{20,}" --include="*.ts" --include="*.js" .
\`\`\`

**Exclude false positives:** skip node_modules, .git, test fixtures with dummy values, environment variable REFERENCES (process.env.X is fine, the actual value is not).

## 3. Check git history for past leaks

\`\`\`bash
# Check if .env was ever committed
git log --all --diff-filter=A -- ".env" ".env.*" "*.pem" "*.key" "credentials.json"

# Search recent commits for secret patterns
git log -p --all -S "sk-ant-" --since="6 months ago" -- "*.ts" "*.js" "*.json"
git log -p --all -S "ghp_" --since="6 months ago"
git log -p --all -S "AKIA" --since="6 months ago"
\`\`\`

If secrets were found in history, warn the user that they need to rotate those credentials AND use \`git filter-repo\` or BFG to purge them.

## 4. Check for files that shouldn't be tracked

\`\`\`bash
# List tracked files that match sensitive patterns
git ls-files | grep -iE "\\.(env|pem|key|p12|pfx|sqlite|db)$"
git ls-files | grep -iE "(credentials|secret|password|token)" | grep -v node_modules
\`\`\`

If found, tell the user how to untrack them:
\`git rm --cached <file>\` then add to .gitignore.

## 5. Report

For each finding:
- **CRITICAL**: Actual secret/credential value found in code or history
- **HIGH**: Sensitive file tracked by git (e.g., .env, *.pem)
- **MEDIUM**: Missing .gitignore entries for common sensitive patterns
- **LOW**: Potential false positive worth reviewing

**Summary table:** Severity | File | Issue | Remediation

If CRITICAL findings exist, stress urgency: rotate the credential immediately, it may already be compromised if the repo was ever public or shared.`,
  },
  {
    id: 'preview',
    name: 'Web Preview Setup',
    description: 'Configure and start a dev server for live web preview. Detects framework, installs deps, starts server, and opens preview.',
    category: 'workflow',
    trigger: '/preview',
    source: 'official',
    promptTemplate: `You are a web development assistant. Set up a live preview for this project.

User request: $ARGUMENTS

## Steps

1. **Detect the project type** by reading the project files:
   - Check for package.json -> Node.js (next, nuxt, vite, react-scripts, etc.)
   - Check for pom.xml / build.gradle -> Java (Spring Boot)
   - Check for requirements.txt / pyproject.toml -> Python (Flask, Django, FastAPI)
   - Check for index.html without package.json -> Static site (use npx serve)

2. **Check dependencies** - if node_modules/ doesn't exist but package.json does:
   - Detect package manager (pnpm-lock.yaml, yarn.lock, bun.lockb, package-lock.json)
   - Run the install command

3. **Find the right dev command** from package.json scripts:
   - Priority: dev > start > serve > preview
   - For static sites: npx serve -l 3000 -s .
   - For Next.js: npm run dev (port 3000)
   - For Nuxt: npm run dev (port 3000)
   - For Vite: npm run dev (port 5173)

4. **Tell the user:**
   - "Go to the **Preview** tab"
   - "Select the script **[name]** and click **Start**"
   - "The preview will appear automatically"

5. **If specific request** (port, flags): modify command, suggest adding to package.json

## Common Issues
- Port in use: lsof -ti:PORT | xargs kill
- node_modules missing: run install
- Blank preview: wait for compilation, refresh
- Static files: npx serve -l 3000 -s .

Do NOT start the server yourself. Guide the user to use the Preview tab.`,
  },
  {
    id: 'dev-setup',
    name: 'Dev Environment Setup',
    description: 'Guide the user through setting up a development environment for any project. Detects stack, installs deps, configures dev server, and explains the Preview panel.',
    category: 'workflow',
    trigger: '/dev-setup',
    source: 'official',
    promptTemplate: `You are a development environment expert. Help the user set up a dev environment for this project.

Target: $ARGUMENTS (a framework name, or empty for auto-detect)

## Steps

1. **Detect the stack** — Read package.json, requirements.txt, Cargo.toml, go.mod, etc.
   Identify: language, framework, package manager, dev scripts

2. **Check prerequisites**:
   - Is the package manager installed? (pnpm, npm, yarn, pip, cargo, etc.)
   - Are node_modules / venv / dependencies installed?
   - Is there a .env file needed? Check for .env.example

3. **Install dependencies** if needed:
   - Node.js: \`pnpm install\` or \`npm install\`
   - Python: \`pip install -r requirements.txt\`
   - etc.

4. **Configure ports** — If there's a port conflict:
   - Check what ports the dev server uses
   - If they conflict with the running Axy (3456/3457), suggest alternatives
   - Update .env or config to use different ports

5. **Start the dev server**:
   - Tell the user to go to the **Preview** tab (under "More")
   - Select the correct dev script from the dropdown
   - Click **Start**
   - The preview iframe will show the running app

6. **Common issues**:
   - Port already in use → change port in config
   - Dependencies not installed → run install command
   - Native modules failing → check build tools (python3, make, g++)
   - Blank preview → wait for compilation, try refresh

## For Axy Self-Development

If this is an Axy project (axy-claude-cli-web):
- Server runs on port 4456 (configured in .env)
- Web runs on port 4457 (configured in apps/web/package.json)
- Use \`pnpm dev\` which runs turbo dev for both
- Or \`pnpm --filter @axy/web dev\` for web only
- Preview will be available on port 4457

Always be specific about which commands to run and in what order.`,
  },
]
