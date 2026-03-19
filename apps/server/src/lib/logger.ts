type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

class Logger {
  private level: LogLevel
  private context?: string

  constructor(context?: string) {
    this.level = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
    this.context = context
  }

  /** Create a child logger with a specific context */
  child(context: string): Logger {
    return new Logger(context)
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (LEVELS[level] < LEVELS[this.level]) return

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      ...(this.context && { context: this.context }),
      message,
      ...data,
    }

    const line = JSON.stringify(entry)

    if (level === 'error') {
      console.error(line)
    } else if (level === 'warn') {
      console.warn(line)
    } else {
      console.log(line)
    }
  }

  debug(message: string, data?: Record<string, unknown>) { this.log('debug', message, data) }
  info(message: string, data?: Record<string, unknown>) { this.log('info', message, data) }
  warn(message: string, data?: Record<string, unknown>) { this.log('warn', message, data) }
  error(message: string, data?: Record<string, unknown>) { this.log('error', message, data) }
}

export const logger = new Logger()
