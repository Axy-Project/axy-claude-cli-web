import dotenv from 'dotenv'

dotenv.config({ path: '../../.env' })

export const config = {
  port: parseInt(process.env.SERVER_PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  useSqlite: process.env.USE_SQLITE === 'true' || !process.env.DATABASE_URL,

  // Claude CLI
  claudePath: process.env.CLAUDE_PATH || 'claude',

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',

  // GitHub
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',

  // Paths
  projectsDir: process.env.PROJECTS_DIR || './data/projects',

  // CORS
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3457'],
} as const

// ─── Startup validation ─────────────────────────────────────
if (Number.isNaN(config.port) || config.port <= 0 || config.port > 65535) {
  throw new Error(`Invalid SERVER_PORT: "${process.env.SERVER_PORT}". Must be a number between 1 and 65535.`)
}

if (config.nodeEnv === 'production') {
  if (config.jwtSecret === 'dev-secret-change-in-production') {
    throw new Error('CRITICAL: JWT_SECRET must be set in production. Do not use the default secret.')
  }
  if (!config.supabaseUrl) {
    console.warn('[config] WARNING: SUPABASE_URL is not set in production. Auth features will be unavailable.')
  }
}
