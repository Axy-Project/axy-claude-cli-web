import * as pty from 'node-pty'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { broadcaster } from '../ws/broadcaster.js'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'

const log = logger.child('terminal')

interface Terminal {
  id: string
  userId: string
  projectId: string
  projectPath: string
  pty: pty.IPty
  createdAt: Date
}

class TerminalService {
  private terminals = new Map<string, Terminal>()

  create(params: { userId: string; projectId: string; projectPath: string; command?: string; args?: string[] }): string {
    const id = crypto.randomUUID()
    const shell = params.command || (process.platform === 'darwin' ? '/bin/zsh' : (process.env.SHELL || '/bin/bash'))

    const cwd = params.projectPath || config.projectsDir
    const resolvedCwd = path.resolve(cwd)

    // Build clean env for the terminal (remove Claude Code env vars)
    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && key !== 'CLAUDECODE' && key !== 'CLAUDE_CODE_ENTRYPOINT' && key !== 'NODE_CHANNEL_FD') {
        env[key] = value
      }
    }
    env.TERM = 'xterm-256color'
    env.COLORTERM = 'truecolor'

    // Create a temporary ZDOTDIR with a .zshrc that restricts cd to project dir
    const zdotdir = path.join(os.tmpdir(), `axy-term-${id}`)
    fs.mkdirSync(zdotdir, { recursive: true })
    const zshrc = `
# Axy Web - restricted terminal
AXY_PROJECT_DIR="${resolvedCwd}"

# Helper to resolve a path without triggering our cd override
__axy_resolve() {
  local target="\$1"
  if [[ "\$target" != /* ]]; then
    target="$(pwd)/\$target"
  fi
  # Use subshell with builtin cd to resolve ../ etc
  (builtin cd "\$target" 2>/dev/null && pwd -P) || echo "\$target"
}

# Override cd to restrict navigation outside project directory
function cd() {
  if [[ \$# -eq 0 ]]; then
    builtin cd "\$AXY_PROJECT_DIR"
    return
  fi
  local resolved
  resolved="$(__axy_resolve "\$1")"
  if [[ "\$resolved" != "\$AXY_PROJECT_DIR" && "\$resolved" != "\$AXY_PROJECT_DIR/"* ]]; then
    echo "\\033[0;31mRestricted: cannot navigate outside project directory\\033[0m"
    return 1
  fi
  builtin cd "\$@"
}

# Also restrict pushd
function pushd() {
  local target="\${1:-.}"
  local resolved
  resolved="$(__axy_resolve "\$target")"
  if [[ "\$resolved" != "\$AXY_PROJECT_DIR" && "\$resolved" != "\$AXY_PROJECT_DIR/"* ]]; then
    echo "\\033[0;31mRestricted: cannot navigate outside project directory\\033[0m"
    return 1
  fi
  builtin pushd "\$@"
}

# Set prompt to show we're in a restricted terminal
PS1="%F{cyan}[axy]%f %~ %# "
`
    fs.writeFileSync(path.join(zdotdir, '.zshrc'), zshrc)

    // Point ZDOTDIR to our custom config so zsh loads our restricted .zshrc
    env.ZDOTDIR = zdotdir
    env.AXY_PROJECT_DIR = resolvedCwd

    log.info('Spawning restricted shell', { shell, cwd })

    const term = pty.spawn(shell, params.args || [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env,
    })

    const terminal: Terminal = {
      id,
      userId: params.userId,
      projectId: params.projectId,
      projectPath: resolvedCwd,
      pty: term,
      createdAt: new Date(),
    }

    this.terminals.set(id, terminal)

    term.onData((data: string) => {
      broadcaster.toTerminal(id, 'terminal:data', { terminalId: id, data })
    })

    term.onExit(({ exitCode }: { exitCode: number }) => {
      broadcaster.toTerminal(id, 'terminal:exit', { terminalId: id, code: exitCode })
      this.terminals.delete(id)
      // Clean up temp zdotdir
      fs.rm(zdotdir, { recursive: true, force: true }, () => {})
    })

    return id
  }

  write(terminalId: string, data: string): void {
    const terminal = this.terminals.get(terminalId)
    if (!terminal) return
    terminal.pty.write(data)
  }

  resize(terminalId: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(terminalId)
    if (!terminal) return
    terminal.pty.resize(cols, rows)
  }

  destroy(terminalId: string): void {
    const terminal = this.terminals.get(terminalId)
    if (!terminal) return
    terminal.pty.kill()
    this.terminals.delete(terminalId)
    // Clean up temp zdotdir
    const zdotdir = path.join(os.tmpdir(), `axy-term-${terminalId}`)
    fs.rm(zdotdir, { recursive: true, force: true }, () => {})
  }

  getByUser(userId: string): Array<{ id: string; projectId: string; createdAt: Date }> {
    const result: Array<{ id: string; projectId: string; createdAt: Date }> = []
    for (const [, terminal] of this.terminals) {
      if (terminal.userId === userId) {
        result.push({ id: terminal.id, projectId: terminal.projectId, createdAt: terminal.createdAt })
      }
    }
    return result
  }

  destroyAllForUser(userId: string): void {
    for (const [id, terminal] of this.terminals) {
      if (terminal.userId === userId) {
        terminal.pty.kill()
        this.terminals.delete(id)
        const zdotdir = path.join(os.tmpdir(), `axy-term-${id}`)
        fs.rm(zdotdir, { recursive: true, force: true }, () => {})
      }
    }
  }

  destroyAll(): void {
    for (const [id, terminal] of this.terminals) {
      log.info('Killing terminal during shutdown', { id, userId: terminal.userId })
      terminal.pty.kill()
      const zdotdir = path.join(os.tmpdir(), `axy-term-${id}`)
      fs.rm(zdotdir, { recursive: true, force: true }, () => {})
    }
    this.terminals.clear()
  }
}

export const terminalService = new TerminalService()
