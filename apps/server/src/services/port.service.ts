import { exec, spawn, type ChildProcess } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export interface PortInfo {
  port: number
  pid: number
  process: string
  protocol: string
  state: string
  isWeb: boolean // likely a web server (common ports or HTTP detected)
}

const WEB_PORTS = new Set([80, 443, 3000, 3001, 3002, 3003, 4000, 4200, 4321, 5000, 5173, 5174, 5175, 8000, 8080, 8081, 8443, 8888, 9000, 9090])

class PortService {
  async listOpenPorts(): Promise<PortInfo[]> {
    try {
      // macOS/Linux: use lsof to find listening TCP ports
      const { stdout } = await execAsync('lsof -iTCP -sTCP:LISTEN -nP 2>/dev/null || ss -tlnp 2>/dev/null', {
        timeout: 5000,
      })

      const ports = this.parseLsof(stdout)
      return ports.sort((a, b) => a.port - b.port)
    } catch (error) {
      console.error('[Ports] Error listing ports:', error)
      return []
    }
  }

  private parseLsof(output: string): PortInfo[] {
    const lines = output.trim().split('\n')
    const portMap = new Map<number, PortInfo>()

    for (const line of lines.slice(1)) { // Skip header
      const parts = line.trim().split(/\s+/)
      if (parts.length < 9) continue

      const processName = parts[0]
      const pid = parseInt(parts[1], 10)
      const nameField = parts[parts.length - 1] // e.g., *:3000 or 127.0.0.1:8080
      const stateField = parts[parts.length - 2] // (LISTEN)

      // Extract port from the name field
      const portMatch = nameField.match(/:(\d+)$/)
      if (!portMatch) continue

      const port = parseInt(portMatch[1], 10)
      if (isNaN(port) || port === 0) continue

      // Skip duplicates (keep first)
      if (portMap.has(port)) continue

      portMap.set(port, {
        port,
        pid,
        process: processName,
        protocol: 'tcp',
        state: stateField?.replace(/[()]/g, '') || 'LISTEN',
        isWeb: WEB_PORTS.has(port) || (port >= 3000 && port <= 9999),
      })
    }

    return Array.from(portMap.values())
  }

  async checkPort(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`lsof -iTCP:${port} -sTCP:LISTEN -nP 2>/dev/null | tail -1`)
      return stdout.trim().length > 0
    } catch {
      return false
    }
  }

  /** Read package.json scripts for a project to detect dev/start commands */
  async getProjectScripts(projectPath: string): Promise<{ name: string; command: string }[]> {
    try {
      const pkgPath = path.join(projectPath, 'package.json')
      const raw = await fs.readFile(pkgPath, 'utf-8')
      const pkg = JSON.parse(raw) as { scripts?: Record<string, string> }
      if (!pkg.scripts) return []

      // Return scripts that look like dev servers
      const relevant = ['dev', 'start', 'serve', 'preview', 'dev:server', 'start:dev']
      const scripts: { name: string; command: string }[] = []

      for (const name of relevant) {
        if (pkg.scripts[name]) {
          scripts.push({ name, command: pkg.scripts[name] })
        }
      }
      // Also include any custom script containing "dev" or "serve"
      for (const [name, cmd] of Object.entries(pkg.scripts)) {
        if (!relevant.includes(name) && (name.includes('dev') || name.includes('serve'))) {
          scripts.push({ name, command: cmd })
        }
      }

      return scripts
    } catch {
      return []
    }
  }

  /** Detect package manager for a project */
  async detectPackageManager(projectPath: string): Promise<'pnpm' | 'yarn' | 'bun' | 'npm'> {
    try {
      await fs.access(path.join(projectPath, 'pnpm-lock.yaml'))
      return 'pnpm'
    } catch { /* not pnpm */ }
    try {
      await fs.access(path.join(projectPath, 'yarn.lock'))
      return 'yarn'
    } catch { /* not yarn */ }
    try {
      await fs.access(path.join(projectPath, 'bun.lockb'))
      return 'bun'
    } catch { /* not bun */ }
    return 'npm'
  }

  /** Running dev servers spawned by us, keyed by projectId */
  private devProcesses = new Map<string, { child: ChildProcess; port?: number; log: string[] }>()

  async startDevServer(projectId: string, projectPath: string, scriptName: string): Promise<{ success: boolean; error?: string }> {
    // Kill existing if any
    this.stopDevServer(projectId)

    const pm = await this.detectPackageManager(projectPath)
    const args = pm === 'npm' ? ['run', scriptName] : [scriptName]

    console.log(`[Ports] Starting ${pm} ${args.join(' ')} in ${projectPath}`)

    const child = spawn(pm, args, {
      cwd: projectPath,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    })

    const log: string[] = []
    const entry = { child, port: undefined as number | undefined, log }
    this.devProcesses.set(projectId, entry)

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString()
      log.push(text)
      if (log.length > 100) log.shift()
      // Try to detect the port from output
      const portMatch = text.match(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{4,5})/)
      if (portMatch && !entry.port) {
        entry.port = parseInt(portMatch[1], 10)
        console.log(`[Ports] Detected dev server port: ${entry.port}`)
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      log.push(text)
      if (log.length > 100) log.shift()
      const portMatch = text.match(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{4,5})/)
      if (portMatch && !entry.port) {
        entry.port = parseInt(portMatch[1], 10)
        console.log(`[Ports] Detected dev server port: ${entry.port}`)
      }
    })

    child.on('close', (code) => {
      console.log(`[Ports] Dev server for ${projectId} exited with code ${code}`)
      this.devProcesses.delete(projectId)
    })

    return { success: true }
  }

  stopDevServer(projectId: string): boolean {
    const entry = this.devProcesses.get(projectId)
    if (entry) {
      entry.child.kill('SIGTERM')
      this.devProcesses.delete(projectId)
      return true
    }
    return false
  }

  getDevServerStatus(projectId: string): { running: boolean; port?: number; log: string[] } {
    const entry = this.devProcesses.get(projectId)
    if (!entry) return { running: false, log: [] }
    return { running: !entry.child.killed, port: entry.port, log: entry.log.slice(-20) }
  }
}

export const portService = new PortService()
