import { spawn, type ChildProcess } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { broadcaster } from '../ws/broadcaster.js'
import { logger } from '../lib/logger.js'
import { sessionService } from './session.service.js'
import { gitService } from './git.service.js'
import { mcpService } from './mcp.service.js'
import { streamBuffer } from './stream-buffer.js'
import { config } from '../config.js'
import { accountService } from './account.service.js'

/**
 * Claude CLI integration service.
 * Spawns the local `claude` CLI with --print --verbose --output-format stream-json
 * to stream responses back to the web client via WebSocket.
 */

interface ChatParams {
  sessionId: string
  userId: string
  content: string
  projectId: string
  projectPath: string
  model: string
  mode: string
  systemPrompt?: string
  permissionMode: string
  allowedTools?: string[]
  disallowedTools?: string[]
  imagePaths?: string[]
  cliSessionId?: string | null
  effort?: 'low' | 'medium' | 'high' | 'max'
}

// CLI stream-json event types (different from Anthropic API format)
interface CliEvent {
  type: string
  subtype?: string
  // system init
  cwd?: string
  session_id?: string
  model?: string
  tools?: string[]
  // assistant message
  message?: {
    id: string
    model: string
    role: string
    content: { type: string; text?: string; thinking?: string; id?: string; name?: string; input?: unknown; signature?: string }[]
    usage?: {
      input_tokens: number
      output_tokens: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
    stop_reason?: string | null
  }
  // tool use
  tool_use_id?: string
  name?: string
  input?: unknown
  // tool result
  content?: unknown
  is_error?: boolean
  // result event
  result?: string
  total_cost_usd?: number
  cost_usd?: number
  duration_ms?: number
  duration_api_ms?: number
  num_turns?: number
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  // backwards compat
  stop_reason?: string
}

const log = logger.child('claude')

export class ClaudeService {
  private activeProcesses = new Map<string, ChildProcess>()
  /** Per-session message queue — messages wait here while a process is active */
  private messageQueues = new Map<string, ChatParams[]>()

  /** Broadcast event to WS clients AND buffer it for replay */
  private emit(sessionId: string, type: string, data: unknown): void {
    streamBuffer.push(sessionId, type, data)
    broadcaster.toSession(sessionId, type as never, data as never)
  }

  /** Queue size for a session */
  getQueueSize(sessionId: string): number {
    return this.messageQueues.get(sessionId)?.length ?? 0
  }

  /** Process the next queued message for a session (if any) */
  private processQueue(sessionId: string): void {
    const queue = this.messageQueues.get(sessionId)
    if (!queue || queue.length === 0) {
      this.messageQueues.delete(sessionId)
      return
    }
    const next = queue.shift()!
    if (queue.length === 0) this.messageQueues.delete(sessionId)
    log.info('Processing queued message', { sessionId, remaining: queue.length })

    // Notify client that queue item is being processed
    broadcaster.toSession(sessionId, 'claude:queue-update' as never, {
      sessionId,
      queueSize: queue.length,
    } as never)

    // Fire-and-forget — sendMessage handles its own errors
    this.sendMessage(next).catch((err) => {
      log.error('Queued message failed', { sessionId, error: (err as Error).message })
    })
  }

  async sendMessage(params: ChatParams): Promise<void> {
    const messageId = crypto.randomUUID()
    const startTime = Date.now()

    // If a process is already running for this session, queue the message
    const existing = this.activeProcesses.get(params.sessionId)
    if (existing) {
      const queue = this.messageQueues.get(params.sessionId) || []
      queue.push(params)
      this.messageQueues.set(params.sessionId, queue)
      log.info('Message queued', { sessionId: params.sessionId, queueSize: queue.length })

      // Notify client about queue update
      broadcaster.toSession(params.sessionId, 'claude:queue-update' as never, {
        sessionId: params.sessionId,
        queueSize: queue.length,
      } as never)
      return
    }

    // Start buffering events for this session
    streamBuffer.start(params.sessionId)

    let mcpConfigPath: string | null = null
    let ghCredentialHelperPath: string | null = null
    let fullText = ''
    let fullThinking = ''
    let toolCalls: { name: string; input: Record<string, unknown>; id: string }[] = []
    let inputTokens = 0
    let outputTokens = 0
    let costUsd = 0
    let capturedCliSessionId: string | null = null

    try {
      // Save user message
      await sessionService.addMessage(params.sessionId, {
        role: 'user',
        contentJson: [{ type: 'text', text: params.content }],
      })

      // --- Auto git branch per session (first message only) ---
      try {
        const { messages: existingMessages } = await sessionService.getMessages(params.sessionId, { limit: 2 })
        // Only the user message we just saved => this is the first message
        const isFirstMessage = existingMessages.length <= 1
        if (isFirstMessage) {
          const status = await gitService.status(params.projectPath)
          if (status.branch) {
            const branchName = `axy/session-${params.sessionId.substring(0, 8)}`
            log.info('Creating git branch', { branch: branchName })
            // Use simple-git to create and checkout a new local branch
            const simpleGit = (await import('simple-git')).default
            await simpleGit(params.projectPath).checkoutLocalBranch(branchName)
            log.info('Checked out branch', { branch: branchName })
          }
        }
      } catch (err) {
        // Git failure should not block the chat
        log.warn('Git branch setup failed (non-fatal)', { error: (err as Error).message })
      }

      // --- Resolve GitHub token for git credential helper (injected later via env) ---
      try {
        const ghToken = await accountService.resolveGitHubToken(params.userId, params.projectId)
        if (ghToken) {
          // Create a temporary credential helper script that provides the token
          // This is secure: token lives only in a temp file readable by this process,
          // and the remote URL stays clean (no token in .git/config)
          ghCredentialHelperPath = path.join(os.tmpdir(), `axy-git-cred-${params.sessionId}.sh`)
          await fs.writeFile(
            ghCredentialHelperPath,
            `#!/bin/sh\necho "username=x-access-token"\necho "password=${ghToken}"\n`,
            { mode: 0o700 },
          )
          log.info('Git credential helper created for Claude session')
        }
      } catch (err) {
        log.warn('Git credential helper setup failed (non-fatal)', { error: (err as Error).message })
      }

      // --- MCP config integration ---
      try {
        const mcpConfig = await mcpService.getConfigForProject(params.projectId)
        if (Object.keys(mcpConfig.mcpServers).length > 0) {
          mcpConfigPath = path.join(os.tmpdir(), `axy-mcp-${params.sessionId}.json`)
          await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2))
          log.info('MCP config written', { path: mcpConfigPath })
        }
      } catch (err) {
        // MCP failure should not block the chat
        log.warn('MCP config setup failed (non-fatal)', { error: (err as Error).message })
        mcpConfigPath = null
      }

      // Build CLI arguments
      // NOTE: --verbose is REQUIRED when using --output-format stream-json with --print
      const args: string[] = [
        '--print',
        '--verbose',
        '--output-format', 'stream-json',
        '--model', params.model,
      ]

      // Effort level (extended thinking)
      if (params.effort) {
        args.push('--effort', params.effort)
      }

      // Resume previous CLI conversation if we have a session ID
      if (params.cliSessionId) {
        args.push('--resume', params.cliSessionId)
        log.info('Resuming CLI session', { cliSessionId: params.cliSessionId })
      }

      // Permission mode - use --permission-mode flag
      // bypassPermissions is blocked by Claude CLI when running as root/sudo,
      // so fall back to acceptEdits in that case (Docker containers run as root by default)
      const isRoot = process.getuid?.() === 0
      if (params.permissionMode === 'bypass') {
        if (isRoot) {
          log.warn('Running as root — downgrading bypass to acceptEdits (Claude CLI restriction)')
          args.push('--permission-mode', 'acceptEdits')
        } else {
          args.push('--permission-mode', 'bypassPermissions')
        }
      } else if (params.permissionMode === 'plan') {
        args.push('--permission-mode', 'plan')
      } else if (params.permissionMode === 'accept_edits') {
        args.push('--permission-mode', 'acceptEdits')
      }
      // For 'default' mode, let the CLI handle permissions normally

      // System prompt
      if (params.systemPrompt) {
        args.push('--system-prompt', params.systemPrompt)
      }

      // Allowed/disallowed tools
      if (params.allowedTools?.length) {
        args.push('--allowedTools', ...params.allowedTools)
      }
      if (params.disallowedTools?.length) {
        args.push('--disallowedTools', ...params.disallowedTools)
      }

      // MCP config
      if (mcpConfigPath) {
        args.push('--mcp-config', mcpConfigPath)
      }

      // Build the prompt - include image file references so Claude can read them
      let prompt = params.content
      if (params.imagePaths?.length) {
        const imageRefs = params.imagePaths.map((p) => p).join('\n')
        prompt = `${params.content}\n\n[Attached images - read these files to see the images:]\n${imageRefs}`
      }

      // The prompt itself
      args.push(prompt)

      // Resolve to absolute path
      const cwd = path.resolve(params.projectPath)

      log.info('Spawning CLI', { command: config.claudePath, cwd })

      // Build clean env - remove Claude-related vars to avoid nested session detection
      const env: Record<string, string | undefined> = { ...process.env, NO_COLOR: '1' }
      delete env.CLAUDECODE
      delete env.CLAUDE_CODE_ENTRYPOINT
      // Also remove Node/tsx-related vars that might interfere
      delete env.NODE_CHANNEL_FD

      // Resolve Claude API key: project account -> user default -> env
      const resolvedApiKey = await accountService.resolveClaudeApiKey(params.userId, params.projectId)
      if (resolvedApiKey) {
        env.ANTHROPIC_API_KEY = resolvedApiKey
      }

      // Inject git credential helper via env so git push/pull works with user's GitHub token
      // GIT_CONFIG_* env vars override git config without modifying .git/config on disk
      if (ghCredentialHelperPath) {
        env.GIT_CONFIG_COUNT = '1'
        env.GIT_CONFIG_KEY_0 = 'credential.helper'
        env.GIT_CONFIG_VALUE_0 = ghCredentialHelperPath
      }

      log.debug('CLAUDECODE in env', { value: env.CLAUDECODE ?? '(unset)' })

      const child = spawn(config.claudePath, args, {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      log.info('Process started', { pid: child.pid })

      // Close stdin - Claude CLI waits for stdin to close before processing
      child.stdin?.end()

      this.activeProcesses.set(params.sessionId, child)

      let buffer = ''

      // Process stdout line by line (stream-json outputs one JSON per line)
      child.stdout?.on('data', (data: Buffer) => {
        const raw = data.toString()
        log.debug('stdout raw', { bytes: raw.length })
        buffer += raw
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            const event: CliEvent = JSON.parse(trimmed)
            this.handleCliEvent(event, params.sessionId, messageId, {
              appendText: (t: string) => { fullText += t },
              appendThinking: (t: string) => { fullThinking += t },
              addToolCall: (tc) => { toolCalls.push(tc) },
              setUsage: (inp: number, out: number) => {
                inputTokens = inp
                outputTokens = out
              },
              setCost: (c: number) => { costUsd = c },
              setCliSessionId: (id: string) => { capturedCliSessionId = id },
            })
          } catch {
            // Not JSON - broadcast as raw text
            if (trimmed) {
              fullText += trimmed + '\n'
              this.emit(params.sessionId, 'claude:stream-chunk', {
                sessionId: params.sessionId,
                messageId,
                chunk: { type: 'text', text: trimmed + '\n' },
              })
            }
          }
        }
      })

      // Capture stderr
      let stderrOutput = ''
      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        stderrOutput += text
        log.error('stderr', { text: text.trim() })
      })

      // Wait for process to exit
      await new Promise<void>((resolve, reject) => {
        child.on('close', (code) => {
          this.activeProcesses.delete(params.sessionId)
          log.info('Process exited', { code })

          // Process any remaining buffer
          if (buffer.trim()) {
            try {
              const event: CliEvent = JSON.parse(buffer.trim())
              if (event.type === 'result') {
                if (event.total_cost_usd) costUsd = event.total_cost_usd
                if (event.result) fullText = event.result
              }
            } catch {
              fullText += buffer
            }
          }

          if (code !== 0 && !fullText) {
            // If --resume failed, clear the stale CLI session ID so next message starts fresh
            if (params.cliSessionId) {
              import('./session.service.js').then(({ sessionService }) => {
                sessionService.updateCliSessionId(params.sessionId, '').catch(() => {})
              }).catch(() => {})
              log.warn('Resume failed — cleared stale cliSessionId', { sessionId: params.sessionId })
            }
            reject(new Error(stderrOutput || `Claude CLI exited with code ${code}`))
          } else {
            resolve()
          }
        })

        child.on('error', (err) => {
          this.activeProcesses.delete(params.sessionId)
          log.error('Spawn error', { error: err.message })
          reject(err)
        })
      })

      const durationMs = Date.now() - startTime

      // Build content blocks for the saved message
      const contentJson: unknown[] = []
      if (fullThinking) {
        contentJson.push({ type: 'thinking', thinking: fullThinking })
      }
      if (fullText) {
        contentJson.push({ type: 'text', text: fullText })
      }
      for (const tc of toolCalls) {
        contentJson.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
      }
      if (contentJson.length === 0) {
        contentJson.push({ type: 'text', text: '(empty response)' })
      }

      // Save assistant message
      await sessionService.addMessage(params.sessionId, {
        role: 'assistant',
        contentJson,
        model: params.model,
        inputTokens,
        outputTokens,
        costUsd,
        durationMs,
        toolCallsJson: toolCalls.length > 0 ? toolCalls : undefined,
        thinkingJson: fullThinking ? [{ thinking: fullThinking, durationMs }] : undefined,
      })

      // Save CLI session ID for conversation continuity (--resume)
      if (capturedCliSessionId) {
        await sessionService.updateCliSessionId(params.sessionId, capturedCliSessionId)
        log.info('Saved CLI session ID', { cliSessionId: capturedCliSessionId })
      }

      // Notify stream end
      this.emit(params.sessionId, 'claude:stream-end', {
        sessionId: params.sessionId,
        messageId,
        usage: { inputTokens, outputTokens, costUsd },
      })

      // Auto-push and auto-deploy if configured (fire-and-forget)
      this.handleAutoActions(params.projectId, params.userId, params.projectPath).catch(() => {})

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      log.error('Error', { error: errorMessage })

      // Save partial response so it's not lost
      try {
        const partialContent: unknown[] = []
        if (fullThinking) partialContent.push({ type: 'thinking', thinking: fullThinking })
        if (fullText) partialContent.push({ type: 'text', text: fullText })
        for (const tc of toolCalls) {
          partialContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
        }
        if (partialContent.length > 0) {
          partialContent.push({ type: 'text', text: `\n\n---\n⚠️ Response interrupted: ${errorMessage}` })
          await sessionService.addMessage(params.sessionId, {
            role: 'assistant',
            contentJson: partialContent,
            model: params.model,
            inputTokens,
            outputTokens,
            costUsd,
            durationMs: Date.now() - Date.now(),
            toolCallsJson: toolCalls.length > 0 ? toolCalls : undefined,
            thinkingJson: fullThinking ? [{ thinking: fullThinking }] : undefined,
          })
          log.info('Saved partial response on error', { sessionId: params.sessionId, blocks: partialContent.length })
        }
      } catch (saveErr) {
        log.error('Failed to save partial response', { error: (saveErr as Error).message })
      }

      this.emit(params.sessionId, 'claude:stream-error', {
        sessionId: params.sessionId,
        error: errorMessage,
      })
    } finally {
      this.activeProcesses.delete(params.sessionId)
      streamBuffer.end(params.sessionId)
      // Clean up temp image files
      if (params.imagePaths?.length) {
        for (const imgPath of params.imagePaths) {
          try { await fs.unlink(imgPath) } catch { /* ignore */ }
        }
      }
      // Clean up MCP config temp file
      if (mcpConfigPath) {
        try { await fs.unlink(mcpConfigPath) } catch { /* ignore */ }
      }
      // Clean up git credential helper temp file
      if (ghCredentialHelperPath) {
        try { await fs.unlink(ghCredentialHelperPath) } catch { /* ignore */ }
      }
      // Process next queued message (if any)
      this.processQueue(params.sessionId)
    }
  }

  /**
   * Handle CLI stream-json events.
   * The CLI format emits: system, assistant (with full content blocks), result
   */
  private handleCliEvent(
    event: CliEvent,
    sessionId: string,
    messageId: string,
    ctx: {
      appendText: (t: string) => void
      appendThinking: (t: string) => void
      addToolCall: (tc: { name: string; input: Record<string, unknown>; id: string }) => void
      setUsage: (inp: number, out: number) => void
      setCost: (c: number) => void
      setCliSessionId: (id: string) => void
    }
  ): void {
    switch (event.type) {
      case 'system':
        // Init event - capture CLI session ID for --resume
        log.info('Session initialized', { cliSessionId: event.session_id })
        if (event.session_id) {
          ctx.setCliSessionId(event.session_id)
        }
        break

      case 'assistant': {
        // Assistant message with content blocks
        const content = event.message?.content || []
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            ctx.appendText(block.text)
            this.emit(sessionId, 'claude:stream-chunk', {
              sessionId,
              messageId,
              chunk: { type: 'text', text: block.text },
            })
          } else if (block.type === 'thinking' && block.thinking) {
            ctx.appendThinking(block.thinking)
            this.emit(sessionId, 'claude:stream-chunk', {
              sessionId,
              messageId,
              chunk: { type: 'thinking', thinking: block.thinking },
            })
          } else if (block.type === 'tool_use' && block.name) {
            ctx.addToolCall({
              name: block.name,
              input: (block.input as Record<string, unknown>) || {},
              id: block.id || '',
            })
            this.emit(sessionId, 'claude:tool-start', {
              sessionId,
              toolName: block.name,
              toolInput: (block.input as Record<string, unknown>) || {},
            })
          }
        }

        // Update usage from message
        if (event.message?.usage) {
          ctx.setUsage(
            event.message.usage.input_tokens + (event.message.usage.cache_read_input_tokens || 0),
            event.message.usage.output_tokens
          )
        }
        break
      }

      case 'tool_use':
        // Tool use event (separate from assistant message content blocks)
        if (event.name) {
          ctx.addToolCall({
            name: event.name,
            input: (event.input as Record<string, unknown>) || {},
            id: event.tool_use_id || '',
          })
          this.emit(sessionId, 'claude:tool-start', {
            sessionId,
            toolName: event.name,
            toolInput: (event.input as Record<string, unknown>) || {},
          })
        }
        break

      case 'tool_result':
        // Tool result - emit to frontend for live display
        this.emit(sessionId, 'claude:tool-end', {
          sessionId,
          toolName: event.name || '',
          toolResult: typeof event.content === 'string' ? event.content : JSON.stringify(event.content || ''),
          isError: event.is_error || false,
        })
        break

      case 'result':
        if (event.session_id) ctx.setCliSessionId(event.session_id)
        if (event.total_cost_usd) ctx.setCost(event.total_cost_usd)
        if (event.usage) {
          ctx.setUsage(
            event.usage.input_tokens + (event.usage.cache_read_input_tokens || 0),
            event.usage.output_tokens
          )
        }
        break

      case 'rate_limit_event':
        // Ignore rate limit info
        break

      default:
        log.debug('Unhandled event type', { type: event.type })
    }
  }

  stopSession(sessionId: string): boolean {
    // Clear any queued messages when user explicitly stops
    this.messageQueues.delete(sessionId)
    const child = this.activeProcesses.get(sessionId)
    if (child) {
      child.kill('SIGTERM')
      this.activeProcesses.delete(sessionId)
      broadcaster.toSession(sessionId, 'claude:queue-update' as never, {
        sessionId,
        queueSize: 0,
      } as never)
      return true
    }
    return false
  }

  stopAll(): void {
    for (const [sessionId, child] of this.activeProcesses) {
      log.info('Killing process during shutdown', { sessionId })
      child.kill('SIGTERM')
    }
    this.activeProcesses.clear()
  }

  isSessionActive(sessionId: string): boolean {
    return this.activeProcesses.has(sessionId)
  }

  private async handleAutoActions(projectId: string, userId: string, projectPath: string) {
    try {
      const { projectService } = await import('./project.service.js')
      const project = await projectService.getById(projectId, userId)
      if (!project) return

      const branch = (await gitService.status(projectPath)).branch

      // Auto-push to GitHub
      if (project.autoPushToGithub) {
        try {
          const token = await accountService.resolveGitHubToken(userId, projectId) || undefined
          await gitService.push(projectPath, 'origin', branch, token)
          logger.info('Auto-push completed', { projectId, branch })
        } catch (err) {
          logger.warn('Auto-push failed', { projectId, error: (err as Error).message })
        }
      }

      // Auto-deploy (trigger matching pipelines)
      if (project.autoDeployOnChange) {
        try {
          const { deployService } = await import('./deploy.service.js')
          await deployService.triggerMatchingPipelines(projectId, branch, userId)
          logger.info('Auto-deploy triggered', { projectId, branch })
        } catch (err) {
          logger.warn('Auto-deploy failed', { projectId, error: (err as Error).message })
        }
      }
    } catch (err) {
      logger.warn('Auto-actions failed', { projectId, error: (err as Error).message })
    }
  }
}

export const claudeService = new ClaudeService()
