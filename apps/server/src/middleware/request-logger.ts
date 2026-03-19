import type { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger.js'

const log = logger.child('http')

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
    }

    if (res.statusCode >= 500) {
      log.error('Request failed', logData)
    } else if (res.statusCode >= 400) {
      log.warn('Request error', logData)
    } else if (req.path !== '/api/health') { // Skip health check noise
      log.info('Request', logData)
    }
  })

  next()
}
