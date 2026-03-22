export const APP_NAME = 'Axy'

export const DEFAULT_MODEL = 'claude-sonnet-4-6'

export const MODELS = [
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', tier: 'premium' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', tier: 'standard' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', tier: 'standard' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', tier: 'fast' },
] as const

export const PERMISSION_MODES = ['default', 'accept_edits', 'bypass', 'plan'] as const
export type PermissionMode = (typeof PERMISSION_MODES)[number]

export const CHAT_MODES = ['code', 'plan', 'review', 'ask'] as const
export type ChatMode = (typeof CHAT_MODES)[number]

export const AGENT_ROLES = ['orchestrator', 'researcher', 'coder', 'tester', 'reviewer', 'general'] as const
export type AgentRole = (typeof AGENT_ROLES)[number]

export const ORG_ROLES = ['owner', 'admin', 'member', 'viewer'] as const
export type OrgRole = (typeof ORG_ROLES)[number]

export const ORG_PLANS = ['free', 'pro', 'enterprise'] as const
export type OrgPlan = (typeof ORG_PLANS)[number]

export const PROJECT_ROLES = ['owner', 'editor', 'viewer'] as const
export type ProjectRole = (typeof PROJECT_ROLES)[number]
