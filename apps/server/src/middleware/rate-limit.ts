import rateLimit from 'express-rate-limit'
import { config } from '../config.js'

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isDev ? 10000 : 1000, // 1000 req/15min in prod (was 100)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
  skip: (req) => {
    // Skip rate limiting for polling endpoints
    const path = req.path
    return path.includes('/health') ||
      path.includes('/login-pty/output') ||
      path.includes('/login/status') ||
      path.includes('/ws')
  },
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isDev ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts, please try again later' },
})
