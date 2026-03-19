import type { Request } from 'express'

/** Safely extract a route param as string (Express 5 returns string | string[]) */
export function param(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value
}
