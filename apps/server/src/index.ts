// Clean up env vars that prevent Claude CLI from running
// (inherited from parent Claude Code session during development)
delete process.env.CLAUDECODE
delete process.env.CLAUDE_CODE_ENTRYPOINT

import express from 'express'
import { createServer } from 'http'
import { config } from './config.js'
import { corsMiddleware } from './middleware/cors.js'
import { apiLimiter } from './middleware/rate-limit.js'
import { requestLogger } from './middleware/request-logger.js'
import { logger } from './lib/logger.js'
import { wsManager } from './ws/manager.js'

// Routes
import healthRouter from './routes/health.js'
import authRouter from './routes/auth.router.js'
import projectsRouter from './routes/projects.router.js'
import sessionsRouter from './routes/sessions.router.js'
import chatRouter from './routes/chat.router.js'
import agentsRouter from './routes/agents.router.js'
import skillsRouter from './routes/skills.router.js'
import gitRouter from './routes/git.router.js'
import filesRouter from './routes/files.router.js'
import githubRouter from './routes/github.router.js'
import orgsRouter from './routes/orgs.router.js'
import tasksRouter from './routes/tasks.router.js'
import notesRouter from './routes/notes.router.js'
import { startTaskScheduler } from './services/task.service.js'
import { claudeService } from './services/claude.service.js'
import { terminalService } from './services/terminal.service.js'
import portsRouter from './routes/ports.router.js'
import mcpRouter from './routes/mcp.router.js'
import usageRouter from './routes/usage.router.js'
import snapshotsRouter from './routes/snapshots.router.js'
import templatesRouter from './routes/templates.router.js'
import searchRouter from './routes/search.router.js'
import activityRouter from './routes/activity.router.js'
import accountsRouter from './routes/accounts.router.js' // Multi-account support
import deployRouter from './routes/deploy.router.js'
import setupRouter from './routes/setup.router.js'
import claudeAuthRouter from './routes/claude-auth.router.js'
import claudeAuthPtyRouter from './routes/claude-auth-pty.router.js'

const app = express()
const server = createServer(app)

// Middleware
app.set('trust proxy', 1) // Trust first proxy (Nginx, Cloudflare, etc.)
app.use(corsMiddleware)
app.use(express.json({ limit: '50mb' }))
app.use(requestLogger)
app.use('/api', apiLimiter)

// Routes
app.use('/api/health', healthRouter)
app.use('/api/setup', setupRouter)
app.use('/api/auth', authRouter)
app.use('/api/claude', claudeAuthRouter)
app.use('/api/claude/login-pty', claudeAuthPtyRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/sessions', sessionsRouter)
app.use('/api/chat', chatRouter)
app.use('/api/agents', agentsRouter)
app.use('/api/skills', skillsRouter)
app.use('/api/git', gitRouter)
app.use('/api/files', filesRouter)
app.use('/api/github', githubRouter)
app.use('/api/orgs', orgsRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/notes', notesRouter)
app.use('/api/ports', portsRouter)
app.use('/api/mcp', mcpRouter)
app.use('/api/usage', usageRouter)
app.use('/api/snapshots', snapshotsRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/search', searchRouter)
app.use('/api/activity', activityRouter)
app.use('/api/accounts', accountsRouter)
app.use('/api/deploy', deployRouter)

// Initialize WebSocket
wsManager.init(server)

// Start task scheduler for recurring tasks
startTaskScheduler()

// Graceful shutdown
function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`)
  claudeService.stopAll()
  terminalService.destroyAll()
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
  // Force exit after 10s if graceful shutdown stalls
  setTimeout(() => {
    logger.warn('Forced exit after timeout')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Start server
server.listen(config.port, config.host, async () => {
  logger.info('Server started', {
    version: '0.1.0',
    port: config.port,
    host: config.host,
    environment: config.nodeEnv,
    url: `http://${config.host}:${config.port}`,
    ws: `ws://${config.host}:${config.port}/ws`,
  })

  // Warm catalog cache from GitHub
  try {
    const { catalogService } = await import('./services/catalog.service.js')
    catalogService.warmCache()
  } catch { /* ignore — catalog will be fetched on first request */ }
})

export default app
