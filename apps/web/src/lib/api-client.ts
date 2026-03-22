import type { ApiResponse } from '@axy/shared'

function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location
    // Behind reverse proxy (standard port 80/443): use same origin
    // Nginx should proxy /api/* to backend:3456
    if (port === '' || port === '80' || port === '443') {
      return `${protocol}//${hostname}`
    }
    // Local dev: frontend on 3457, backend on 3456
    return `${protocol}//${hostname}:3456`
  }
  return 'http://localhost:3456'
}

const MAX_RETRIES = 2
const INITIAL_BACKOFF_MS = 500

function isRetryable(error: unknown, status?: number): boolean {
  // Retry on network failures (TypeError from fetch)
  if (error instanceof TypeError) return true
  // Retry on 5xx server errors, not on 4xx client errors
  if (status !== undefined && status >= 500) return true
  return false
}

function backoffMs(attempt: number): number {
  // Exponential backoff: 500ms, 1500ms
  return INITIAL_BACKOFF_MS * (2 ** attempt - 1) + INITIAL_BACKOFF_MS
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class ApiClient {
  private token: string | null = null

  setToken(token: string | null) {
    this.token = token
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    let lastError: unknown
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${getApiUrl()}${path}`, {
          ...options,
          headers,
        })

        let data: ApiResponse<T>
        try {
          data = await response.json()
        } catch {
          throw new Error(`Invalid JSON response: ${response.status}`)
        }

        if (!response.ok) {
          if (attempt < MAX_RETRIES && isRetryable(null, response.status)) {
            await sleep(backoffMs(attempt))
            continue
          }
          throw new Error(data.error || `Request failed: ${response.status}`)
        }

        return data
      } catch (error) {
        lastError = error
        if (attempt < MAX_RETRIES && isRetryable(error)) {
          await sleep(backoffMs(attempt))
          continue
        }
        throw error
      }
    }

    throw lastError
  }

  private extractData<T>(res: ApiResponse<T>): T {
    if (res.data !== undefined && res.data !== null) {
      return res.data
    }
    // Allow responses with success:true but no data (e.g. push, pull, stage)
    if (res.success) {
      return undefined as T
    }
    throw new Error(res.error || 'API response missing data')
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.request<T>(path)
    return this.extractData(res)
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
    return this.extractData(res)
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    return this.extractData(res)
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    return this.extractData(res)
  }

  async delete(path: string, body?: Record<string, unknown>): Promise<void> {
    await this.request(path, {
      method: 'DELETE',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
  }
}

export const api = new ApiClient()
