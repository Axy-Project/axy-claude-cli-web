export interface AuthUser {
  id: string
  supabaseId: string
  email: string
  displayName: string
  avatarUrl?: string
  githubUsername?: string
  createdAt: string
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: AuthUser
}

export interface LoginRequest {
  provider: 'github' | 'google'
  redirectUrl?: string
}

export interface LoginResponse {
  url: string
}

export interface AuthCallbackRequest {
  code: string
  state?: string
}

export interface AuthCallbackResponse {
  session: AuthSession
}
