import rateLimit from 'express-rate-limit'
import { config } from '../config.js'

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isDev ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isDev ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts, please try again later' },
})
