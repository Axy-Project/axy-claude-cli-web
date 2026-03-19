import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export interface AuthenticatedRequest extends Request {
  userId?: string
  userEmail?: string
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid authorization header' })
    return
  }

  const token = authHeader.slice(7)

  try {
    const payload = jwt.verify(token, config.jwtSecret) as {
      sub: string
      email: string
      iat: number
      exp: number
    }

    req.userId = payload.sub
    req.userEmail = payload.email
    next()
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

export function generateToken(userId: string, email: string): string {
  return jwt.sign(
    { sub: userId, email },
    config.jwtSecret,
    { expiresIn: '7d' }
  )
}
