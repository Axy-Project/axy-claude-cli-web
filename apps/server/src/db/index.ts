import { config } from '../config.js'

/* eslint-disable @typescript-eslint/no-explicit-any */
let _db: any
let _schema: any

if (config.useSqlite) {
  // SQLite for local development
  const BetterSqlite3 = (await import('better-sqlite3')).default
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const sqliteSchema = await import('./schema-sqlite.js')

  const sqlite = new BetterSqlite3('axy-dev.db')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  // Auto-create tables for dev
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      supabase_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      github_username TEXT,
      github_token_encrypted TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connected_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      nickname TEXT NOT NULL,
      token_encrypted TEXT NOT NULL,
      username TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      avatar_url TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      settings_json TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS org_members (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL DEFAULT 'member',
      joined_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      org_id TEXT REFERENCES organizations(id),
      name TEXT NOT NULL,
      description TEXT,
      local_path TEXT NOT NULL,
      github_repo_url TEXT,
      github_repo_full_name TEXT,
      default_branch TEXT NOT NULL DEFAULT 'main',
      claude_md_content TEXT,
      settings_json TEXT DEFAULT '{}',
      permission_mode TEXT NOT NULL DEFAULT 'default',
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT,
      model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
      mode TEXT NOT NULL DEFAULT 'code',
      cli_session_id TEXT,
      parent_session_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      total_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_output_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost_usd REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      role TEXT NOT NULL,
      content_json TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cost_usd REAL,
      duration_ms INTEGER,
      tool_calls_json TEXT,
      thinking_json TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      org_id TEXT REFERENCES organizations(id),
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      color TEXT,
      role TEXT NOT NULL DEFAULT 'general',
      model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
      system_prompt TEXT,
      allowed_tools_json TEXT,
      disallowed_tools_json TEXT,
      max_tokens INTEGER NOT NULL DEFAULT 16384,
      temperature REAL NOT NULL DEFAULT 1.0,
      extended_thinking INTEGER NOT NULL DEFAULT 0,
      thinking_budget INTEGER NOT NULL DEFAULT 10000,
      permission_mode TEXT NOT NULL DEFAULT 'default',
      boss_agent_id TEXT,
      hierarchy_level INTEGER NOT NULL DEFAULT 0,
      budget_monthly_usd REAL,
      budget_daily_usd REAL,
      total_tasks_completed INTEGER NOT NULL DEFAULT 0,
      total_cost_usd REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      org_id TEXT REFERENCES organizations(id),
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      trigger TEXT,
      prompt_template TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      allowed_tools_json TEXT,
      is_global INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      source_url TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      config_json TEXT NOT NULL,
      is_official INTEGER NOT NULL DEFAULT 0,
      download_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permission_rules (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      tool_pattern TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS token_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      session_id TEXT NOT NULL REFERENCES sessions(id),
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'stdio',
      command TEXT NOT NULL,
      args_json TEXT DEFAULT '[]',
      env_json TEXT DEFAULT '{}',
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      project_id TEXT NOT NULL REFERENCES projects(id),
      type TEXT NOT NULL DEFAULT 'background_task',
      status TEXT NOT NULL DEFAULT 'pending',
      title TEXT NOT NULL,
      description TEXT,
      command TEXT,
      result TEXT,
      error TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT DEFAULT '{}',
      started_at INTEGER,
      completed_at INTEGER,
      duration_ms INTEGER,
      cron_expression TEXT,
      is_recurring INTEGER DEFAULT 0,
      next_run_at INTEGER,
      last_run_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      project_id TEXT REFERENCES projects(id),
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT,
      events TEXT DEFAULT '[]',
      is_enabled INTEGER NOT NULL DEFAULT 1,
      last_triggered_at INTEGER,
      last_status INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      project_id TEXT REFERENCES projects(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#7c3aed',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_handwritten INTEGER NOT NULL DEFAULT 0,
      canvas_data_json TEXT,
      tags TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)

  // Create deploy tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS deploy_pipelines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      branch_pattern TEXT NOT NULL,
      sftp_host TEXT NOT NULL,
      sftp_port INTEGER NOT NULL DEFAULT 22,
      sftp_username TEXT NOT NULL,
      sftp_password_encrypted TEXT,
      sftp_private_key_encrypted TEXT,
      sftp_remote_path TEXT NOT NULL,
      sftp_source_path TEXT NOT NULL DEFAULT '.',
      pre_deploy_command TEXT,
      webhook_url TEXT,
      webhook_type TEXT NOT NULL DEFAULT 'custom',
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deploy_runs (
      id TEXT PRIMARY KEY,
      pipeline_id TEXT NOT NULL REFERENCES deploy_pipelines(id),
      project_id TEXT NOT NULL REFERENCES projects(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      branch TEXT NOT NULL,
      commit_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      files_uploaded INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      webhook_status INTEGER,
      started_at INTEGER,
      completed_at INTEGER,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL
    );
  `)

  // Migration: add cli_session_id column if missing
  try {
    const cols = sqlite.prepare("PRAGMA table_info('sessions')").all() as { name: string }[]
    if (!cols.some((c) => c.name === 'cli_session_id')) {
      sqlite.exec("ALTER TABLE sessions ADD COLUMN cli_session_id TEXT")
      console.log('[DB] Migrated: added cli_session_id to sessions')
    }
    if (!cols.some((c) => c.name === 'is_pinned')) {
      sqlite.exec("ALTER TABLE sessions ADD COLUMN is_pinned INTEGER DEFAULT 0")
      console.log('[DB] Migrated: added is_pinned to sessions')
    }
    if (!cols.some((c) => c.name === 'effort')) {
      sqlite.exec("ALTER TABLE sessions ADD COLUMN effort TEXT NOT NULL DEFAULT 'medium'")
      console.log('[DB] Migrated: added effort to sessions')
    }
  } catch { /* table might not exist yet */ }

  // Migration: add local auth columns to users
  try {
    const userCols = sqlite.prepare("PRAGMA table_info('users')").all() as { name: string }[]
    if (!userCols.some((c) => c.name === 'password_hash')) {
      sqlite.exec("ALTER TABLE users ADD COLUMN password_hash TEXT")
      console.log('[DB] Migrated: added password_hash to users')
    }
    if (!userCols.some((c) => c.name === 'is_admin')) {
      sqlite.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
      console.log('[DB] Migrated: added is_admin to users')
    }
    if (!userCols.some((c) => c.name === 'is_approved')) {
      sqlite.exec("ALTER TABLE users ADD COLUMN is_approved INTEGER NOT NULL DEFAULT 1")
      console.log('[DB] Migrated: added is_approved to users')
    }
  } catch { /* table might not exist yet */ }

  // Create system_settings table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)

  // Migration: add auto-deploy columns to projects
  try {
    const projCols2 = sqlite.prepare("PRAGMA table_info('projects')").all() as { name: string }[]
    if (!projCols2.some((c) => c.name === 'auto_push_to_github')) {
      sqlite.exec("ALTER TABLE projects ADD COLUMN auto_push_to_github INTEGER NOT NULL DEFAULT 0")
      console.log('[DB] Migrated: added auto_push_to_github to projects')
    }
    if (!projCols2.some((c) => c.name === 'auto_deploy_on_change')) {
      sqlite.exec("ALTER TABLE projects ADD COLUMN auto_deploy_on_change INTEGER NOT NULL DEFAULT 0")
      console.log('[DB] Migrated: added auto_deploy_on_change to projects')
    }
  } catch { /* table might not exist yet */ }

  // Migration: add scheduling columns to tasks if missing
  try {
    const taskCols = sqlite.prepare("PRAGMA table_info('tasks')").all() as { name: string }[]
    if (!taskCols.some((c) => c.name === 'cron_expression')) {
      sqlite.exec("ALTER TABLE tasks ADD COLUMN cron_expression TEXT")
      sqlite.exec("ALTER TABLE tasks ADD COLUMN is_recurring INTEGER DEFAULT 0")
      sqlite.exec("ALTER TABLE tasks ADD COLUMN next_run_at INTEGER")
      sqlite.exec("ALTER TABLE tasks ADD COLUMN last_run_at INTEGER")
      console.log('[DB] Migrated: added scheduling columns to tasks')
    }
  } catch { /* table might not exist yet */ }

  // Migration: add connected_accounts table and project columns if missing
  try {
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='connected_accounts'").all()
    if (tables.length === 0) {
      sqlite.exec(`
        CREATE TABLE connected_accounts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          type TEXT NOT NULL,
          nickname TEXT NOT NULL,
          token_encrypted TEXT NOT NULL,
          username TEXT,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `)
      console.log('[DB] Migrated: created connected_accounts table')
    }
    const projCols = sqlite.prepare("PRAGMA table_info('projects')").all() as { name: string }[]
    if (!projCols.some((c) => c.name === 'github_account_id')) {
      sqlite.exec("ALTER TABLE projects ADD COLUMN github_account_id TEXT REFERENCES connected_accounts(id)")
      console.log('[DB] Migrated: added github_account_id to projects')
    }
    if (!projCols.some((c) => c.name === 'claude_account_id')) {
      sqlite.exec("ALTER TABLE projects ADD COLUMN claude_account_id TEXT REFERENCES connected_accounts(id)")
      console.log('[DB] Migrated: added claude_account_id to projects')
    }
  } catch { /* table might not exist yet */ }

  // Migrate existing github tokens from users to connected_accounts
  try {
    const usersWithTokens = sqlite.prepare(
      "SELECT id, github_username, github_token_encrypted FROM users WHERE github_token_encrypted IS NOT NULL"
    ).all() as { id: string; github_username: string | null; github_token_encrypted: string }[]
    for (const u of usersWithTokens) {
      // Check if already migrated
      const existing = sqlite.prepare(
        "SELECT id FROM connected_accounts WHERE user_id = ? AND type = 'github' AND is_default = 1"
      ).get(u.id)
      if (!existing) {
        const now = Date.now()
        sqlite.prepare(
          "INSERT INTO connected_accounts (id, user_id, type, nickname, token_encrypted, username, is_default, created_at, updated_at) VALUES (?, ?, 'github', ?, ?, ?, 1, ?, ?)"
        ).run(crypto.randomUUID(), u.id, u.github_username || 'GitHub (migrated)', u.github_token_encrypted, u.github_username, now, now)
        console.log(`[DB] Migrated GitHub token for user ${u.id} to connected_accounts`)
      }
    }
  } catch { /* migration might fail if tables not ready */ }

  // Create indexes for performance (idempotent)
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_project ON sessions(user_id, project_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_notes_user_project ON notes(user_id, project_id);
    CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_token_usage_session ON token_usage(session_id);
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
    CREATE INDEX IF NOT EXISTS idx_connected_accounts_user ON connected_accounts(user_id, type);
    CREATE INDEX IF NOT EXISTS idx_deploy_pipelines_project ON deploy_pipelines(project_id);
    CREATE INDEX IF NOT EXISTS idx_deploy_runs_pipeline ON deploy_runs(pipeline_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_deploy_runs_project ON deploy_runs(project_id, created_at);
  `)

  _db = drizzle(sqlite, { schema: sqliteSchema })
  _schema = sqliteSchema

  console.log('[DB] Using SQLite (axy-dev.db)')
} else {
  // PostgreSQL for production
  const pg = (await import('pg')).default
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const pgSchema = await import('./schema.js')

  const pool = new pg.Pool({ connectionString: config.databaseUrl })

  // Auto-create tables for PostgreSQL (same as SQLite but with PG syntax)
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        supabase_id TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT,
        avatar_url TEXT,
        github_username TEXT,
        github_token_encrypted TEXT,
        is_admin BOOLEAN NOT NULL DEFAULT false,
        is_approved BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS connected_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        type TEXT NOT NULL,
        nickname TEXT NOT NULL,
        token_encrypted TEXT NOT NULL,
        username TEXT,
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        avatar_url TEXT,
        plan TEXT NOT NULL DEFAULT 'free',
        settings_json JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS org_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        user_id UUID NOT NULL REFERENCES users(id),
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        org_id UUID REFERENCES organizations(id),
        name TEXT NOT NULL,
        description TEXT,
        local_path TEXT NOT NULL,
        github_repo_url TEXT,
        github_repo_full_name TEXT,
        default_branch TEXT NOT NULL DEFAULT 'main',
        claude_md_content TEXT,
        settings_json JSONB DEFAULT '{}',
        permission_mode TEXT NOT NULL DEFAULT 'default',
        github_account_id UUID REFERENCES connected_accounts(id),
        claude_account_id UUID REFERENCES connected_accounts(id),
        auto_push_to_github BOOLEAN NOT NULL DEFAULT false,
        auto_deploy_on_change BOOLEAN NOT NULL DEFAULT false,
        is_archived BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id),
        user_id UUID NOT NULL REFERENCES users(id),
        title TEXT,
        model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
        mode TEXT NOT NULL DEFAULT 'code',
        effort TEXT NOT NULL DEFAULT 'medium',
        cli_session_id TEXT,
        parent_session_id UUID,
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_pinned INTEGER DEFAULT 0,
        total_input_tokens INTEGER NOT NULL DEFAULT 0,
        total_output_tokens INTEGER NOT NULL DEFAULT 0,
        total_cost_usd REAL NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES sessions(id),
        role TEXT NOT NULL,
        content_json JSONB NOT NULL,
        model TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cost_usd REAL,
        duration_ms INTEGER,
        tool_calls_json JSONB,
        thinking_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS agent_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        org_id UUID REFERENCES organizations(id),
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT,
        role TEXT NOT NULL DEFAULT 'general',
        model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
        system_prompt TEXT,
        allowed_tools_json JSONB,
        disallowed_tools_json JSONB,
        max_tokens INTEGER NOT NULL DEFAULT 16384,
        temperature REAL NOT NULL DEFAULT 1.0,
        extended_thinking BOOLEAN NOT NULL DEFAULT false,
        thinking_budget INTEGER NOT NULL DEFAULT 10000,
        permission_mode TEXT NOT NULL DEFAULT 'default',
        boss_agent_id UUID,
        hierarchy_level INTEGER NOT NULL DEFAULT 0,
        budget_monthly_usd REAL,
        budget_daily_usd REAL,
        total_tasks_completed INTEGER NOT NULL DEFAULT 0,
        total_cost_usd REAL NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        org_id UUID REFERENCES organizations(id),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        trigger TEXT,
        prompt_template TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        allowed_tools_json JSONB,
        is_global BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS agent_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        source_url TEXT,
        category TEXT NOT NULL DEFAULT 'general',
        config_json JSONB NOT NULL,
        is_official BOOLEAN NOT NULL DEFAULT false,
        download_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS permission_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id),
        tool_pattern TEXT NOT NULL,
        action TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS token_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        session_id UUID NOT NULL REFERENCES sessions(id),
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cost_usd REAL NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id),
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'stdio',
        command TEXT NOT NULL,
        args_json JSONB DEFAULT '[]',
        env_json JSONB DEFAULT '{}',
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id),
        user_id UUID NOT NULL REFERENCES users(id),
        project_id UUID NOT NULL REFERENCES projects(id),
        type TEXT NOT NULL DEFAULT 'background_task',
        status TEXT NOT NULL DEFAULT 'pending',
        title TEXT NOT NULL,
        description TEXT,
        command TEXT,
        result TEXT,
        error TEXT,
        progress INTEGER NOT NULL DEFAULT 0,
        metadata_json JSONB DEFAULT '{}',
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        duration_ms INTEGER,
        cron_expression TEXT,
        is_recurring BOOLEAN DEFAULT false,
        next_run_at TIMESTAMPTZ,
        last_run_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        project_id UUID REFERENCES projects(id),
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        secret TEXT,
        events JSONB DEFAULT '[]',
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        last_triggered_at TIMESTAMPTZ,
        last_status INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        project_id UUID REFERENCES projects(id),
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#7c3aed',
        is_pinned BOOLEAN NOT NULL DEFAULT false,
        is_handwritten BOOLEAN NOT NULL DEFAULT false,
        canvas_data_json TEXT,
        tags JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS deploy_pipelines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id),
        user_id UUID NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        branch_pattern TEXT NOT NULL,
        sftp_host TEXT NOT NULL,
        sftp_port INTEGER NOT NULL DEFAULT 22,
        sftp_username TEXT NOT NULL,
        sftp_password_encrypted TEXT,
        sftp_private_key_encrypted TEXT,
        sftp_remote_path TEXT NOT NULL,
        sftp_source_path TEXT NOT NULL DEFAULT '.',
        pre_deploy_command TEXT,
        webhook_url TEXT,
        webhook_type TEXT NOT NULL DEFAULT 'custom',
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS deploy_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pipeline_id UUID NOT NULL REFERENCES deploy_pipelines(id),
        project_id UUID NOT NULL REFERENCES projects(id),
        user_id UUID NOT NULL REFERENCES users(id),
        branch TEXT NOT NULL,
        commit_hash TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        files_uploaded INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        webhook_status INTEGER,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        duration_ms INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    console.log('[DB] PostgreSQL tables auto-created')
  } catch (err) {
    console.error('[DB] PostgreSQL auto-create error (tables may already exist):', (err as Error).message)
  } finally {
    client.release()
  }

  _db = drizzle(pool, { schema: pgSchema })
  _schema = pgSchema

  console.log('[DB] Using PostgreSQL')
}

export const db = _db
export const schema = _schema
