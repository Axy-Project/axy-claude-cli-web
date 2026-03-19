import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ─── Users ───────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  supabaseId: text('supabase_id').unique().notNull(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  githubUsername: text('github_username'),
  githubTokenEncrypted: text('github_token_encrypted'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Connected Accounts ─────────────────────────────────
export const connectedAccounts = sqliteTable('connected_accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // 'github' | 'claude_api_key'
  nickname: text('nickname').notNull(),
  tokenEncrypted: text('token_encrypted').notNull(),
  username: text('username'), // GitHub username (null for claude keys)
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Organizations ───────────────────────────────────────
export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  avatarUrl: text('avatar_url'),
  plan: text('plan').notNull().default('free'),
  settingsJson: text('settings_json', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Org Members ─────────────────────────────────────────
export const orgMembers = sqliteTable('org_members', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text('org_id').references(() => organizations.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  role: text('role').notNull().default('member'),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Projects ────────────────────────────────────────────
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id).notNull(),
  orgId: text('org_id').references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  localPath: text('local_path').notNull(),
  githubRepoUrl: text('github_repo_url'),
  githubRepoFullName: text('github_repo_full_name'),
  defaultBranch: text('default_branch').notNull().default('main'),
  claudeMdContent: text('claude_md_content'),
  settingsJson: text('settings_json', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  permissionMode: text('permission_mode').notNull().default('default'),
  githubAccountId: text('github_account_id').references(() => connectedAccounts.id),
  claudeAccountId: text('claude_account_id').references(() => connectedAccounts.id),
  autoPushToGithub: integer('auto_push_to_github', { mode: 'boolean' }).notNull().default(false),
  autoDeployOnChange: integer('auto_deploy_on_change', { mode: 'boolean' }).notNull().default(false),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Sessions ────────────────────────────────────────────
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').references(() => projects.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  title: text('title'),
  model: text('model').notNull().default('claude-sonnet-4-6'),
  mode: text('mode').notNull().default('code'),
  effort: text('effort').notNull().default('medium'),
  cliSessionId: text('cli_session_id'), // Claude CLI session ID for --resume
  parentSessionId: text('parent_session_id'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isPinned: integer('is_pinned').default(0),
  totalInputTokens: integer('total_input_tokens').notNull().default(0),
  totalOutputTokens: integer('total_output_tokens').notNull().default(0),
  totalCostUsd: real('total_cost_usd').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Messages ────────────────────────────────────────────
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').references(() => sessions.id).notNull(),
  role: text('role').notNull(),
  contentJson: text('content_json', { mode: 'json' }).$type<unknown[]>().notNull(),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costUsd: real('cost_usd'),
  durationMs: integer('duration_ms'),
  toolCallsJson: text('tool_calls_json', { mode: 'json' }).$type<unknown[]>(),
  thinkingJson: text('thinking_json', { mode: 'json' }).$type<unknown[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Agent Profiles ──────────────────────────────────────
export const agentProfiles = sqliteTable('agent_profiles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id).notNull(),
  orgId: text('org_id').references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  color: text('color'),
  role: text('role').notNull().default('general'),
  model: text('model').notNull().default('claude-sonnet-4-20250514'),
  systemPrompt: text('system_prompt'),
  allowedToolsJson: text('allowed_tools_json', { mode: 'json' }).$type<string[]>(),
  disallowedToolsJson: text('disallowed_tools_json', { mode: 'json' }).$type<string[]>(),
  maxTokens: integer('max_tokens').notNull().default(16384),
  temperature: real('temperature').notNull().default(1.0),
  extendedThinking: integer('extended_thinking', { mode: 'boolean' }).notNull().default(false),
  thinkingBudget: integer('thinking_budget').notNull().default(10000),
  permissionMode: text('permission_mode').notNull().default('default'),
  bossAgentId: text('boss_agent_id'),
  hierarchyLevel: integer('hierarchy_level').notNull().default(0),
  budgetMonthlyUsd: real('budget_monthly_usd'),
  budgetDailyUsd: real('budget_daily_usd'),
  totalTasksCompleted: integer('total_tasks_completed').notNull().default(0),
  totalCostUsd: real('total_cost_usd').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Skills ──────────────────────────────────────────────
export const skills = sqliteTable('skills', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id).notNull(),
  orgId: text('org_id').references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  trigger: text('trigger'),
  promptTemplate: text('prompt_template').notNull(),
  category: text('category').notNull().default('general'),
  allowedToolsJson: text('allowed_tools_json', { mode: 'json' }).$type<string[]>(),
  isGlobal: integer('is_global', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Agent Templates ─────────────────────────────────────
export const agentTemplates = sqliteTable('agent_templates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  sourceUrl: text('source_url'),
  category: text('category').notNull().default('general'),
  configJson: text('config_json', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  isOfficial: integer('is_official', { mode: 'boolean' }).notNull().default(false),
  downloadCount: integer('download_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Permission Rules ────────────────────────────────────
export const permissionRules = sqliteTable('permission_rules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').references(() => projects.id).notNull(),
  toolPattern: text('tool_pattern').notNull(),
  action: text('action').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Token Usage ─────────────────────────────────────────
export const tokenUsage = sqliteTable('token_usage', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id).notNull(),
  sessionId: text('session_id').references(() => sessions.id).notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  costUsd: real('cost_usd').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── MCP Servers ─────────────────────────────────────────
export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').references(() => projects.id).notNull(),
  name: text('name').notNull(),
  type: text('type').notNull().default('stdio'),
  command: text('command').notNull(),
  argsJson: text('args_json', { mode: 'json' }).$type<string[]>().default([]),
  envJson: text('env_json', { mode: 'json' }).$type<Record<string, string>>().default({}),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Tasks ──────────────────────────────────────────────
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').references(() => sessions.id),
  userId: text('user_id').references(() => users.id).notNull(),
  projectId: text('project_id').references(() => projects.id).notNull(),
  type: text('type').notNull().default('background_task'), // background_task, slash_command, subagent
  status: text('status').notNull().default('pending'), // pending, running, completed, failed, cancelled
  title: text('title').notNull(),
  description: text('description'),
  command: text('command'), // The slash command or CLI command
  result: text('result'), // Output/result text
  error: text('error'),
  progress: integer('progress').notNull().default(0), // 0-100
  metadataJson: text('metadata_json', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  durationMs: integer('duration_ms'),
  cronExpression: text('cron_expression'),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).default(false),
  nextRunAt: integer('next_run_at', { mode: 'timestamp' }),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Webhooks ────────────────────────────────────────────
export const webhooks = sqliteTable('webhooks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id).notNull(),
  projectId: text('project_id').references(() => projects.id),
  name: text('name').notNull(),
  url: text('url').notNull(),
  secret: text('secret'),
  events: text('events', { mode: 'json' }).$type<string[]>().default([]),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  lastTriggeredAt: integer('last_triggered_at', { mode: 'timestamp' }),
  lastStatus: integer('last_status'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Notes ──────────────────────────────────────────────
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id).notNull(),
  projectId: text('project_id').references(() => projects.id),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  color: text('color').notNull().default('#7c3aed'), // default purple
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  isHandwritten: integer('is_handwritten', { mode: 'boolean' }).notNull().default(false),
  canvasDataJson: text('canvas_data_json'), // for handwritten notes - stores strokes as JSON
  tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Deploy Pipelines ──────────────────────────────────
export const deployPipelines = sqliteTable('deploy_pipelines', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').references(() => projects.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  branchPattern: text('branch_pattern').notNull(), // 'main', 'staging', 'release/*'
  sftpHost: text('sftp_host').notNull(),
  sftpPort: integer('sftp_port').notNull().default(22),
  sftpUsername: text('sftp_username').notNull(),
  sftpPasswordEncrypted: text('sftp_password_encrypted'),
  sftpPrivateKeyEncrypted: text('sftp_private_key_encrypted'),
  sftpRemotePath: text('sftp_remote_path').notNull(),
  sftpSourcePath: text('sftp_source_path').notNull().default('.'),
  preDeployCommand: text('pre_deploy_command'), // e.g. 'npm run build'
  webhookUrl: text('webhook_url'),
  webhookType: text('webhook_type').notNull().default('custom'), // 'discord' | 'slack' | 'custom'
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// ─── Deploy Runs ──────────────────────────────────────
export const deployRuns = sqliteTable('deploy_runs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  pipelineId: text('pipeline_id').references(() => deployPipelines.id).notNull(),
  projectId: text('project_id').references(() => projects.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  branch: text('branch').notNull(),
  commitHash: text('commit_hash'),
  status: text('status').notNull().default('pending'), // pending | running | success | failed
  filesUploaded: integer('files_uploaded').notNull().default(0),
  error: text('error'),
  webhookStatus: integer('webhook_status'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  durationMs: integer('duration_ms'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})
