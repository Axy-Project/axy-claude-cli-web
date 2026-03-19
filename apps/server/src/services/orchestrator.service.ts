import type { AgentRole } from '@axy/shared'

// ─── Built-in Agent Types ───────────────────────────────

export interface BuiltInAgent {
  id: string
  name: string
  role: AgentRole
  description: string
  systemPrompt: string
  model: string
  icon: string
  color: string
}

export interface RoutingResult {
  agent: BuiltInAgent | null
  reasoning: string
  suggestedModel?: string
}

// ─── Built-in Agent Archetypes ──────────────────────────

export const BUILT_IN_AGENTS: BuiltInAgent[] = [
  {
    id: 'planner',
    name: 'Planner',
    role: 'orchestrator',
    description: 'Decomposes complex tasks into steps',
    systemPrompt:
      'You are a planning agent. Break down the user request into clear, actionable steps. Output a numbered plan.',
    model: 'claude-sonnet-4-6',
    icon: '\u{1F4CB}',
    color: '#7c3aed',
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    role: 'reviewer',
    description: 'Reviews code for quality, security, and best practices',
    systemPrompt:
      'You are a code review agent. Analyze code for bugs, security issues, performance problems, and suggest improvements.',
    model: 'claude-sonnet-4-6',
    icon: '\u{1F50D}',
    color: '#2563eb',
  },
  {
    id: 'security-analyst',
    name: 'Security Analyst',
    role: 'reviewer',
    description: 'Analyzes code for security vulnerabilities',
    systemPrompt:
      'You are a security analysis agent. Check for OWASP Top 10, injection attacks, XSS, CSRF, credential leaks, and other vulnerabilities.',
    model: 'claude-opus-4-6',
    icon: '\u{1F6E1}\uFE0F',
    color: '#dc2626',
  },
  {
    id: 'tdd-guide',
    name: 'TDD Guide',
    role: 'tester',
    description: 'Guides test-driven development',
    systemPrompt:
      'You are a TDD agent. Help write failing tests first (RED), then minimal implementation (GREEN), then refactor (IMPROVE).',
    model: 'claude-sonnet-4-6',
    icon: '\u{1F9EA}',
    color: '#059669',
  },
  {
    id: 'debugger',
    name: 'Debugger',
    role: 'coder',
    description: 'Troubleshoots and fixes bugs',
    systemPrompt:
      'You are a debugging agent. Analyze errors, trace root causes, and suggest fixes. Be methodical and thorough.',
    model: 'claude-opus-4-6',
    icon: '\u{1F41B}',
    color: '#d97706',
  },
  {
    id: 'architect',
    name: 'Architect',
    role: 'orchestrator',
    description: 'Designs system architecture and makes structural decisions',
    systemPrompt:
      'You are an architecture agent. Design scalable, maintainable systems. Consider trade-offs, patterns, and best practices.',
    model: 'claude-opus-4-6',
    icon: '\u{1F3D7}\uFE0F',
    color: '#8b5cf6',
  },
  {
    id: 'doc-writer',
    name: 'Documentation Writer',
    role: 'general',
    description: 'Writes and updates documentation',
    systemPrompt:
      'You are a documentation agent. Write clear, concise documentation. Include examples and keep docs in sync with code.',
    model: 'claude-haiku-4-5-20251001',
    icon: '\u{1F4DD}',
    color: '#0891b2',
  },
  {
    id: 'model-router',
    name: 'Model Router',
    role: 'orchestrator',
    description: 'Routes tasks to the optimal model based on complexity',
    systemPrompt:
      'Analyze task complexity. Route: Haiku for simple/fast tasks, Sonnet for standard coding, Opus for complex reasoning/architecture.',
    model: 'claude-haiku-4-5-20251001',
    icon: '\u{1F500}',
    color: '#475569',
  },
]

// ─── Routing Patterns ───────────────────────────────────

interface RoutingPattern {
  patterns: RegExp[]
  agentId: string
  reasoning: string
}

const ROUTING_PATTERNS: RoutingPattern[] = [
  {
    patterns: [
      /\b(security|vulnerabilit|owasp|xss|csrf|injection|cve|exploit)\b/i,
      /\bsecurity[\s-]?(review|audit|scan|check|analys)/i,
    ],
    agentId: 'security-analyst',
    reasoning: 'Detected security-related keywords. Routing to Security Analyst for vulnerability analysis.',
  },
  {
    patterns: [
      /\b(review|code[\s-]?review|check[\s-]?(my|this|the)[\s-]?code|audit[\s-]?code|pr[\s-]?review)\b/i,
      /\b(code[\s-]?quality|lint|best[\s-]?practice|clean[\s-]?code)\b/i,
    ],
    agentId: 'code-reviewer',
    reasoning: 'Detected code review request. Routing to Code Reviewer for quality analysis.',
  },
  {
    patterns: [
      /\b(architect|system[\s-]?design|design[\s-]?pattern|microservice|monolith|scalab|infrastructure)\b/i,
      /\b(database[\s-]?design|schema[\s-]?design|api[\s-]?design|high[\s-]?level[\s-]?design)\b/i,
    ],
    agentId: 'architect',
    reasoning: 'Detected architecture/design question. Routing to Architect for system design guidance.',
  },
  {
    patterns: [
      /\b(plan|break[\s-]?down|decompos|step[\s-]?by[\s-]?step|roadmap|strategy|outline)\b/i,
      /\b(how[\s-]?should[\s-]?i|what[\s-]?steps|what's[\s-]?the[\s-]?approach)\b/i,
    ],
    agentId: 'planner',
    reasoning: 'Detected planning request. Routing to Planner for task decomposition.',
  },
  {
    patterns: [
      /\b(test|tdd|spec|unit[\s-]?test|integration[\s-]?test|e2e|coverage|jest|vitest|pytest|mocha)\b/i,
      /\b(write[\s-]?test|add[\s-]?test|test[\s-]?case|test[\s-]?suite|test[\s-]?driven)\b/i,
    ],
    agentId: 'tdd-guide',
    reasoning: 'Detected testing-related request. Routing to TDD Guide for test-driven development.',
  },
  {
    patterns: [
      /\b(bug|debug|fix|error|crash|broken|issue|exception|stack[\s-]?trace|traceback)\b/i,
      /\b(not[\s-]?working|fails|failing|unexpected|wrong[\s-]?output|undefined[\s-]?is[\s-]?not)\b/i,
    ],
    agentId: 'debugger',
    reasoning: 'Detected debugging request. Routing to Debugger for troubleshooting.',
  },
  {
    patterns: [
      /\b(document|readme|docs|jsdoc|docstring|comment[\s-]?code|api[\s-]?doc|changelog)\b/i,
      /\b(write[\s-]?doc|update[\s-]?doc|add[\s-]?doc)\b/i,
    ],
    agentId: 'doc-writer',
    reasoning: 'Detected documentation request. Routing to Documentation Writer.',
  },
]

// ─── Orchestrator Service ───────────────────────────────

export class OrchestratorService {
  private agentsMap: Map<string, BuiltInAgent>

  constructor() {
    this.agentsMap = new Map()
    for (const agent of BUILT_IN_AGENTS) {
      this.agentsMap.set(agent.id, agent)
    }
  }

  /**
   * Analyze a user message and return the best-matching built-in agent.
   * Uses keyword/pattern matching (no LLM call) for fast routing.
   */
  analyzeAndRoute(
    message: string,
    _projectContext?: { projectId: string; sessionId: string }
  ): RoutingResult {
    // Check each routing pattern in priority order
    for (const route of ROUTING_PATTERNS) {
      for (const pattern of route.patterns) {
        if (pattern.test(message)) {
          const agent = this.agentsMap.get(route.agentId) ?? null
          return {
            agent,
            reasoning: route.reasoning,
            suggestedModel: agent?.model,
          }
        }
      }
    }

    // No match - use default (no agent)
    return {
      agent: null,
      reasoning: 'No specialized agent matched. Using default model.',
    }
  }

  /** Get a built-in agent by ID. */
  getAgent(agentId: string): BuiltInAgent | undefined {
    return this.agentsMap.get(agentId)
  }

  /** Get all built-in agents. */
  getAllAgents(): BuiltInAgent[] {
    return BUILT_IN_AGENTS
  }
}

export const orchestratorService = new OrchestratorService()
