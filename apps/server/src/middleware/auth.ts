import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { eq } from 'drizzle-orm'

export interface AuthenticatedRequest extends Request {
  userId?: string
  userEmail?: string
  isAdmin?: boolean
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

    // Check if user is approved (async, import lazily to avoid circular deps)
    import('../db/index.js').then(({ db, schema }) => {
      db.select({ isApproved: schema.users.isApproved, isAdmin: schema.users.isAdmin })
        .from(schema.users)
        .where(eq(schema.users.id, payload.sub))
        .limit(1)
        .then((rows: { isApproved: boolean | null; isAdmin: boolean | null }[]) => {
          const user = rows[0]
          if (user && !user.isApproved) {
            res.status(403).json({ success: false, error: 'Account pending approval. An admin must approve your access.' })
            return
          }
          req.isAdmin = user?.isAdmin ?? false
          next()
        })
        .catch(() => next()) // DB error → let through (don't block)
    }).catch(() => next())
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
