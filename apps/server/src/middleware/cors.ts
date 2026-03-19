import cors from 'cors'
import { config } from '../config.js'

export const corsMiddleware = cors({
  origin: config.isDev
    ? true  // Allow all origins in dev (supports LAN access)
    : config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})
