import type { PermissionMode, ChatMode, AgentRole, OrgRole, OrgPlan, ProjectRole } from '../constants'

// ─── Users ───────────────────────────────────────────────
export interface User {
  id: string
  supabaseId: string
  email: string
  displayName: string
  avatarUrl?: string
  githubUsername?: string
  createdAt: string
  updatedAt: string
}

// ─── Connected Accounts ─────────────────────────────────
export type ConnectedAccountType = 'github' | 'claude_api_key'

export interface ConnectedAccount {
  id: string
  userId: string
  type: ConnectedAccountType
  nickname: string
  username?: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateConnectedAccountInput {
  type: ConnectedAccountType
  nickname: string
  token: string
  username?: string
  isDefault?: boolean
}

export interface UpdateConnectedAccountInput {
  nickname?: string
  token?: string
  isDefault?: boolean
}

// ─── Organizations ───────────────────────────────────────
export interface Organization {
  id: string
  name: string
  slug: string
  avatarUrl?: string
  plan: OrgPlan
  settingsJson: Record<string, unknown>
  createdAt: string
}

export interface OrgMember {
  id: string
  orgId: string
  userId: string
  role: OrgRole
  joinedAt: string
  user?: User
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: ProjectRole
  canChat: boolean
  canEditFiles: boolean
  canManageGit: boolean
  canViewSettings: boolean
  canEditSettings: boolean
  joinedAt: string
  user?: User
}

// ─── Projects ────────────────────────────────────────────
export interface Project {
  id: string
  userId: string
  orgId?: string
  name: string
  description?: string
  avatarUrl?: string
  localPath: string
  githubRepoUrl?: string
  githubRepoFullName?: string
  defaultBranch: string
  claudeMdContent?: string
  settingsJson: Record<string, unknown>
  permissionMode: PermissionMode
  githubAccountId?: string | null
  claudeAccountId?: string | null
  autoPushToGithub: boolean
  autoDeployOnChange: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  description?: string
  githubRepoUrl?: string
  orgId?: string
  permissionMode?: PermissionMode
  githubAccountId?: string | null
  claudeAccountId?: string | null
}

export interface ImportProjectInput {
  name: string
  description?: string
  localPath: string
  permissionMode?: PermissionMode
  orgId?: string
}

// ─── Sessions ────────────────────────────────────────────
export interface Session {
  id: string
  projectId: string
  userId: string
  title?: string
  model: string
  mode: ChatMode
  effort?: string
  cliSessionId?: string | null
  parentSessionId?: string
  isActive: boolean
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  createdAt: string
  updatedAt: string
}

export interface CreateSessionInput {
  projectId: string
  title?: string
  model?: string
  mode?: ChatMode
  agentId?: string
}

// ─── Messages ────────────────────────────────────────────
export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'image'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  content?: string
  thinking?: string
  mimeType?: string
}

export interface Message {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  contentJson: ContentBlock[]
  model?: string
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  durationMs?: number
  toolCallsJson?: ToolCall[]
  thinkingJson?: ThinkingBlock[]
  createdAt: string
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  result?: string
  error?: string
  durationMs?: number
}

export interface ThinkingBlock {
  thinking: string
  durationMs?: number
}

export interface SendMessageInput {
  sessionId: string
  content: string
  mode?: ChatMode
  agentId?: string
}

// ─── Agent Profiles ──────────────────────────────────────
export interface AgentProfile {
  id: string
  userId: string
  orgId?: string
  name: string
  description?: string
  icon?: string
  color?: string
  role: AgentRole
  model: string
  systemPrompt?: string
  allowedToolsJson?: string[]
  disallowedToolsJson?: string[]
  maxTokens: number
  temperature: number
  extendedThinking: boolean
  thinkingBudget: number
  permissionMode: PermissionMode
  bossAgentId?: string
  hierarchyLevel: number
  budgetMonthlyUsd?: number
  budgetDailyUsd?: number
  totalTasksCompleted: number
  totalCostUsd: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateAgentInput {
  name: string
  description?: string
  icon?: string
  color?: string
  role?: AgentRole
  model?: string
  systemPrompt?: string
  allowedToolsJson?: string[]
  disallowedToolsJson?: string[]
  maxTokens?: number
  temperature?: number
  extendedThinking?: boolean
  thinkingBudget?: number
  permissionMode?: PermissionMode
  bossAgentId?: string
  budgetMonthlyUsd?: number
  budgetDailyUsd?: number
  orgId?: string
}

// ─── Skills ──────────────────────────────────────────────
export interface Skill {
  id: string
  userId: string
  orgId?: string
  name: string
  description: string
  trigger?: string
  promptTemplate: string
  category: string
  allowedToolsJson?: string[]
  isGlobal: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateSkillInput {
  name: string
  description: string
  trigger?: string
  promptTemplate: string
  category?: string
  allowedToolsJson?: string[]
  isGlobal?: boolean
  orgId?: string
}

// ─── Agent Templates ─────────────────────────────────────
export interface AgentTemplate {
  id: string
  name: string
  description?: string
  sourceUrl?: string
  category: string
  configJson: {
    agents?: Partial<CreateAgentInput>[]
    skills?: Partial<CreateSkillInput>[]
    claudeMd?: string
    mcpServers?: Record<string, unknown>
  }
  isOfficial: boolean
  downloadCount: number
  createdAt: string
}

// ─── Permission Rules ────────────────────────────────────
export interface PermissionRule {
  id: string
  projectId: string
  toolPattern: string
  action: 'allow' | 'deny'
  createdAt: string
}

// ─── Token Usage ─────────────────────────────────────────
export interface TokenUsage {
  id: string
  userId: string
  sessionId: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  createdAt: string
}

// ─── MCP Servers ─────────────────────────────────────────
export interface McpServer {
  id: string
  projectId: string
  name: string
  type: string
  command: string
  argsJson: string[]
  envJson: Record<string, string>
  isEnabled: boolean
  createdAt: string
}

// ─── Git ─────────────────────────────────────────────────
export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: GitFileChange[]
  unstaged: GitFileChange[]
  untracked: string[]
  hasRemote: boolean
}

export interface GitFileChange {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
}

export interface GitLogEntry {
  hash: string
  message: string
  author: string
  date: string
}

// ─── Files ───────────────────────────────────────────────
export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  size?: number
}

// ─── Tasks ──────────────────────────────────────────────
export type TaskType = 'background_task' | 'slash_command' | 'subagent'
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'scheduled'

export interface Task {
  id: string
  sessionId?: string
  userId: string
  projectId: string
  type: TaskType
  status: TaskStatus
  title: string
  description?: string
  command?: string
  result?: string
  error?: string
  progress: number
  metadataJson: Record<string, unknown>
  cronExpression?: string
  isRecurring?: boolean
  nextRunAt?: string
  lastRunAt?: string
  startedAt?: string
  completedAt?: string
  durationMs?: number
  createdAt: string
  updatedAt: string
}

export interface CreateTaskInput {
  sessionId?: string
  projectId: string
  type?: TaskType
  title: string
  description?: string
  command?: string
  metadataJson?: Record<string, unknown>
}

// ─── Slash Commands ─────────────────────────────────────
export interface SlashCommand {
  name: string
  description: string
  category: 'session' | 'project' | 'claude' | 'custom'
  icon?: string
  requiresArgs?: boolean
  argHint?: string
}

// ─── Notes ──────────────────────────────────────────────
export interface Note {
  id: string
  userId: string
  projectId?: string
  title: string
  content: string
  color: string
  isPinned: boolean
  isHandwritten: boolean
  canvasDataJson?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateNoteInput {
  projectId?: string
  title: string
  content?: string
  color?: string
  isPinned?: boolean
  isHandwritten?: boolean
  canvasDataJson?: string
  tags?: string[]
}

// ─── Deploy Pipelines ───────────────────────────────────
export type WebhookType = 'discord' | 'slack' | 'custom'
export type DeployStatus = 'pending' | 'running' | 'success' | 'failed'

export interface DeployPipeline {
  id: string
  projectId: string
  userId: string
  name: string
  branchPattern: string
  sftpHost: string
  sftpPort: number
  sftpUsername: string
  sftpRemotePath: string
  sftpSourcePath: string
  preDeployCommand?: string
  webhookUrl?: string
  webhookType: WebhookType
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateDeployPipelineInput {
  name: string
  branchPattern: string
  sftpHost: string
  sftpPort?: number
  sftpUsername: string
  sftpPassword?: string
  sftpPrivateKey?: string
  sftpRemotePath: string
  sftpSourcePath?: string
  preDeployCommand?: string
  webhookUrl?: string
  webhookType?: WebhookType
}

export interface DeployRun {
  id: string
  pipelineId: string
  projectId: string
  userId: string
  branch: string
  commitHash?: string
  status: DeployStatus
  filesUploaded: number
  error?: string
  webhookStatus?: number
  startedAt?: string
  completedAt?: string
  durationMs?: number
  createdAt: string
  pipelineName?: string
}
