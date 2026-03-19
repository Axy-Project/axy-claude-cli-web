/** Standard API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/** Paginated response */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** Pagination query params */
export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/** Project query filters */
export interface ProjectFilters extends PaginationParams {
  orgId?: string
  isArchived?: boolean
  search?: string
}

/** Session query filters */
export interface SessionFilters extends PaginationParams {
  projectId: string
  isActive?: boolean
}

/** Agent query filters */
export interface AgentFilters extends PaginationParams {
  orgId?: string
  role?: string
  isActive?: boolean
}

/** GitHub repo search */
export interface GitHubRepoSearchParams {
  query?: string
  page?: number
  perPage?: number
  sort?: 'updated' | 'stars' | 'name'
}

/** Clone repo request */
export interface CloneRepoRequest {
  repoUrl: string
  projectName: string
  orgId?: string
}

/** Usage stats */
export interface UsageStats {
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  byModel: {
    model: string
    inputTokens: number
    outputTokens: number
    costUsd: number
  }[]
  byDay: {
    date: string
    inputTokens: number
    outputTokens: number
    costUsd: number
  }[]
}
