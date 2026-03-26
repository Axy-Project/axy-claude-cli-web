import { pgTable, uuid, text, timestamp, boolean, integer, real, jsonb, unique } from 'drizzle-orm/pg-core'

// ─── Users ───────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  supabaseId: text('supabase_id').unique().notNull(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  githubUsername: text('github_username'),
  githubTokenEncrypted: text('github_token_encrypted'),
  isAdmin: boolean('is_admin').notNull().default(false),
  isApproved: boolean('is_approved').notNull().default(true),
  totpSecretEncrypted: text('totp_secret_encrypted'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── System Settings ────────────────────────────────────
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Connected Accounts ─────────────────────────────────
export const connectedAccounts = pgTable('connected_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // 'github' | 'claude_api_key'
  nickname: text('nickname').notNull(),
  tokenEncrypted: text('token_encrypted').notNull(),
  username: text('username'), // GitHub username (null for claude keys)
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Organizations ───────────────────────────────────────
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  avatarUrl: text('avatar_url'),
  plan: text('plan').notNull().default('free'),
  settingsJson: jsonb('settings_json').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Org Members ─────────────────────────────────────────
export const orgMembers = pgTable('org_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull().default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('org_user_unique').on(table.orgId, table.userId),
])

// ─── Projects ────────────────────────────────────────────
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description'),
  avatarUrl: text('avatar_url'),
  localPath: text('local_path').notNull(),
  githubRepoUrl: text('github_repo_url'),
  githubRepoFullName: text('github_repo_full_name'),
  defaultBranch: text('default_branch').notNull().default('main'),
  claudeMdContent: text('claude_md_content'),
  settingsJson: jsonb('settings_json').default({}),
  permissionMode: text('permission_mode').notNull().default('default'),
  githubAccountId: uuid('github_account_id').references(() => connectedAccounts.id, { onDelete: 'set null' }),
  claudeAccountId: uuid('claude_account_id').references(() => connectedAccounts.id, { onDelete: 'set null' }),
  autoPushToGithub: boolean('auto_push_to_github').notNull().default(false),
  autoDeployOnChange: boolean('auto_deploy_on_change').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Sessions ────────────────────────────────────────────
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title'),
  model: text('model').notNull().default('claude-sonnet-4-6'),
  mode: text('mode').notNull().default('code'),
  effort: text('effort').notNull().default('medium'),
  cliSessionId: text('cli_session_id'),
  parentSessionId: uuid('parent_session_id'),
  isActive: boolean('is_active').notNull().default(true),
  isPinned: integer('is_pinned').default(0),
  totalInputTokens: integer('total_input_tokens').notNull().default(0),
  totalOutputTokens: integer('total_output_tokens').notNull().default(0),
  totalCostUsd: real('total_cost_usd').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Messages ────────────────────────────────────────────
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull(),
  contentJson: jsonb('content_json').notNull(),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costUsd: real('cost_usd'),
  durationMs: integer('duration_ms'),
  toolCallsJson: jsonb('tool_calls_json'),
  thinkingJson: jsonb('thinking_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Agent Profiles ──────────────────────────────────────
export const agentProfiles = pgTable('agent_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  color: text('color'),
  role: text('role').notNull().default('general'),
  model: text('model').notNull().default('claude-sonnet-4-20250514'),
  systemPrompt: text('system_prompt'),
  allowedToolsJson: jsonb('allowed_tools_json'),
  disallowedToolsJson: jsonb('disallowed_tools_json'),
  maxTokens: integer('max_tokens').notNull().default(16384),
  temperature: real('temperature').notNull().default(1.0),
  extendedThinking: boolean('extended_thinking').notNull().default(false),
  thinkingBudget: integer('thinking_budget').notNull().default(10000),
  permissionMode: text('permission_mode').notNull().default('default'),
  bossAgentId: uuid('boss_agent_id'),
  hierarchyLevel: integer('hierarchy_level').notNull().default(0),
  budgetMonthlyUsd: real('budget_monthly_usd'),
  budgetDailyUsd: real('budget_daily_usd'),
  totalTasksCompleted: integer('total_tasks_completed').notNull().default(0),
  totalCostUsd: real('total_cost_usd').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Skills ──────────────────────────────────────────────
export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  trigger: text('trigger'),
  promptTemplate: text('prompt_template').notNull(),
  category: text('category').notNull().default('general'),
  allowedToolsJson: jsonb('allowed_tools_json'),
  isGlobal: boolean('is_global').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Agent Templates ─────────────────────────────────────
export const agentTemplates = pgTable('agent_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  sourceUrl: text('source_url'),
  category: text('category').notNull().default('general'),
  configJson: jsonb('config_json').notNull(),
  isOfficial: boolean('is_official').notNull().default(false),
  downloadCount: integer('download_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Project Members ────────────────────────────────────
export const projectMembers = pgTable('project_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull().default('viewer'),
  canChat: boolean('can_chat').notNull().default(true),
  canEditFiles: boolean('can_edit_files').notNull().default(false),
  canManageGit: boolean('can_manage_git').notNull().default(false),
  canViewSettings: boolean('can_view_settings').notNull().default(false),
  canEditSettings: boolean('can_edit_settings').notNull().default(false),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Permission Rules ────────────────────────────────────
export const permissionRules = pgTable('permission_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  toolPattern: text('tool_pattern').notNull(),
  action: text('action').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Token Usage ─────────────────────────────────────────
export const tokenUsage = pgTable('token_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  costUsd: real('cost_usd').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Tasks ──────────────────────────────────────────────
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull().default('background_task'),
  status: text('status').notNull().default('pending'),
  title: text('title').notNull(),
  description: text('description'),
  command: text('command'),
  result: text('result'),
  error: text('error'),
  progress: integer('progress').notNull().default(0),
  metadataJson: jsonb('metadata_json').default({}),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),
  cronExpression: text('cron_expression'),
  isRecurring: boolean('is_recurring').default(false),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Webhooks ────────────────────────────────────────────
export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  secret: text('secret'),
  events: jsonb('events').default([]),
  isEnabled: boolean('is_enabled').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  lastStatus: integer('last_status'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Notes ──────────────────────────────────────────────
export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  color: text('color').notNull().default('#7c3aed'),
  isPinned: boolean('is_pinned').notNull().default(false),
  isHandwritten: boolean('is_handwritten').notNull().default(false),
  canvasDataJson: text('canvas_data_json'),
  tags: jsonb('tags').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── MCP Servers ─────────────────────────────────────────
export const mcpServers = pgTable('mcp_servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  type: text('type').notNull().default('stdio'),
  command: text('command').notNull(),
  argsJson: jsonb('args_json').default([]),
  envJson: jsonb('env_json').default({}),
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Deploy Pipelines ──────────────────────────────────
export const deployPipelines = pgTable('deploy_pipelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  branchPattern: text('branch_pattern').notNull(),
  sftpHost: text('sftp_host').notNull(),
  sftpPort: integer('sftp_port').notNull().default(22),
  sftpUsername: text('sftp_username').notNull(),
  sftpPasswordEncrypted: text('sftp_password_encrypted'),
  sftpPrivateKeyEncrypted: text('sftp_private_key_encrypted'),
  sftpRemotePath: text('sftp_remote_path').notNull(),
  sftpSourcePath: text('sftp_source_path').notNull().default('.'),
  preDeployCommand: text('pre_deploy_command'),
  webhookUrl: text('webhook_url'),
  webhookType: text('webhook_type').notNull().default('custom'),
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Deploy Runs ──────────────────────────────────────
export const deployRuns = pgTable('deploy_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  pipelineId: uuid('pipeline_id').references(() => deployPipelines.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  branch: text('branch').notNull(),
  commitHash: text('commit_hash'),
  status: text('status').notNull().default('pending'),
  filesUploaded: integer('files_uploaded').notNull().default(0),
  error: text('error'),
  webhookStatus: integer('webhook_status'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Notifications ──────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // 'chat_complete' | 'team_message' | 'deploy_done' | 'deploy_failed' | 'mention' | 'system'
  title: text('title').notNull(),
  body: text('body'),
  link: text('link'), // e.g. /projects/xxx/chat/yyy
  read: boolean('read').notNull().default(false),
  metadataJson: jsonb('metadata_json').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Team Messages ──────────────────────────────────────
export const teamMessages = pgTable('team_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  replyToId: uuid('reply_to_id'), // Self-referencing for threads
  linkedSessionId: uuid('linked_session_id').references(() => sessions.id, { onDelete: 'set null' }), // Link to a Claude chat session
  linkedProjectId: uuid('linked_project_id').references(() => projects.id, { onDelete: 'set null' }), // Link to a project
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
