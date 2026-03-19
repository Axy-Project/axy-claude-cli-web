import { Router, type Request, type Response } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js'
import { portService } from '../services/port.service.js'
import { projectService } from '../services/project.service.js'
import { param } from '../middleware/params.js'
import http from 'http'

const router = Router()

/** GET /api/ports - List all open ports (auth required) */
router.get('/', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  try {
    const ports = await portService.listOpenPorts()
    res.json({ success: true, data: ports })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/ports/project/:projectId/scripts - Get available dev scripts for a project */
router.get('/project/:projectId/scripts', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'projectId'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const scripts = await portService.getProjectScripts(project.localPath)
    const pm = await portService.detectPackageManager(project.localPath)
    res.json({ success: true, data: { scripts, packageManager: pm } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/ports/project/:projectId/start - Start a dev server */
router.post('/project/:projectId/start', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectService.getById(param(req, 'projectId'), req.userId!)
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }
    const { script } = req.body as { script: string }
    if (!script) {
      res.status(400).json({ success: false, error: 'script is required' })
      return
    }
    const result = await portService.startDevServer(project.id, project.localPath, script)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** POST /api/ports/project/:projectId/stop - Stop a dev server */
router.post('/project/:projectId/stop', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const projectId = param(req, 'projectId')
    const stopped = portService.stopDevServer(projectId)
    res.json({ success: true, data: { stopped } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/ports/project/:projectId/status - Get dev server status */
router.get('/project/:projectId/status', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const projectId = param(req, 'projectId')
    const status = portService.getDevServerStatus(projectId)
    res.json({ success: true, data: status })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/** GET /api/ports/:port/check - Check if a specific port is open (auth required) */
router.get('/:port/check', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const port = parseInt(req.params.port as string, 10)
    const isOpen = await portService.checkPort(port)
    res.json({ success: true, data: { port, isOpen } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

/**
 * Reverse proxy: /api/ports/:port/proxy/any/path → localhost:port/any/path
 * No auth required - allows iframe embedding from any device on the network.
 * Uses router.use() to match prefix; req.url has the remaining path.
 */
router.use('/:port/proxy', (req: Request, res: Response) => {
  const port = parseInt(req.params.port as string, 10)
  if (isNaN(port) || port < 1 || port > 65535) {
    res.status(400).json({ success: false, error: 'Invalid port' })
    return
  }

  // req.url contains everything after the matched mount point
  // e.g., for /api/ports/5173/proxy/assets/main.js → req.url = "/assets/main.js"
  const proxyPath = req.url || '/'

  const options: http.RequestOptions = {
    hostname: 'localhost',
    port,
    path: proxyPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: `localhost:${port}`,
    },
  }

  // Remove headers that shouldn't be forwarded
  const headers = options.headers as Record<string, unknown>
  delete headers['connection']
  delete headers['transfer-encoding']
  delete headers['accept-encoding'] // avoid compressed responses

  // Script to inject into HTML responses - captures console output and sends to parent
  const consoleInjectionScript = `<script>(function(){var o=console.log,w=console.warn,e=console.error;function s(l,a){try{parent.postMessage({type:'axy:console',level:l,args:Array.from(a).map(function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}),port:${port}},'*')}catch(ex){}}console.log=function(){s('log',arguments);o.apply(console,arguments)};console.warn=function(){s('warn',arguments);w.apply(console,arguments)};console.error=function(){s('error',arguments);e.apply(console,arguments)};window.addEventListener('error',function(ev){s('error',['Uncaught: '+ev.message+' at '+ev.filename+':'+ev.lineno])});window.addEventListener('unhandledrejection',function(ev){s('error',['Unhandled rejection: '+ev.reason])})})()</script>`

  const proxyReq = http.request(options, (proxyRes) => {
    // Rewrite Location redirects to go through our proxy
    const location = proxyRes.headers['location']
    if (location && location.startsWith('/')) {
      proxyRes.headers['location'] = `/api/ports/${port}/proxy${location}`
    }

    const contentType = proxyRes.headers['content-type'] || ''
    const isHtml = contentType.includes('text/html')

    if (isHtml) {
      // Collect body, inject console script, then send
      const chunks: Buffer[] = []
      proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk))
      proxyRes.on('end', () => {
        let body = Buffer.concat(chunks).toString()
        // Inject script right after <head> or at the start
        if (body.includes('<head>')) {
          body = body.replace('<head>', '<head>' + consoleInjectionScript)
        } else if (body.includes('<head ')) {
          body = body.replace(/<head\s[^>]*>/, '$&' + consoleInjectionScript)
        } else {
          body = consoleInjectionScript + body
        }
        // Update content-length
        const rewrittenHeaders = { ...proxyRes.headers }
        rewrittenHeaders['content-length'] = String(Buffer.byteLength(body))
        res.writeHead(proxyRes.statusCode || 200, rewrittenHeaders)
        res.end(body)
      })
    } else {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
      proxyRes.pipe(res, { end: true })
    }
  })

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: `Cannot connect to localhost:${port}: ${err.message}` })
    }
  })

  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    req.pipe(proxyReq, { end: true })
  } else {
    proxyReq.end()
  }
})

export default router
