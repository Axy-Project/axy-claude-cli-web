import { logger } from '../lib/logger.js'

const CATALOG_BASE = 'https://raw.githubusercontent.com/Axy-Project/axy-catalog/main'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

interface CachedData {
  data: any[]
  fetchedAt: number
}

let skillsCache: CachedData | null = null
let javaSkillsCache: CachedData | null = null
let agentsCache: CachedData | null = null

async function fetchJson(url: string): Promise<any[] | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    return await res.json() as any[]
  } catch (err) {
    logger.warn('Catalog fetch failed', { url, error: (err as Error).message })
    return null
  }
}

function isValid(cache: CachedData | null): boolean {
  return cache !== null && Date.now() - cache.fetchedAt < CACHE_TTL
}

export class CatalogService {
  async getSkills(): Promise<any[]> {
    const [skills, javaSkills] = await Promise.all([
      this.fetchSkills(),
      this.fetchJavaSkills(),
    ])
    return [...skills, ...javaSkills]
  }

  async getAgents(): Promise<any[]> {
    if (isValid(agentsCache)) return agentsCache!.data
    const data = await fetchJson(`${CATALOG_BASE}/agents/catalog.json`)
    if (data) {
      agentsCache = { data, fetchedAt: Date.now() }
      return data
    }
    return agentsCache ? agentsCache.data : []
  }

  private async fetchSkills(): Promise<any[]> {
    if (isValid(skillsCache)) return skillsCache!.data
    const data = await fetchJson(`${CATALOG_BASE}/skills/catalog.json`)
    if (data) {
      skillsCache = { data, fetchedAt: Date.now() }
      return data
    }
    return skillsCache ? skillsCache.data : []
  }

  private async fetchJavaSkills(): Promise<any[]> {
    if (isValid(javaSkillsCache)) return javaSkillsCache!.data
    const data = await fetchJson(`${CATALOG_BASE}/skills/java.json`)
    if (data) {
      javaSkillsCache = { data, fetchedAt: Date.now() }
      return data
    }
    return javaSkillsCache ? javaSkillsCache.data : []
  }

  async warmCache(): Promise<void> {
    try {
      const [skills, agents] = await Promise.all([
        this.getSkills(),
        this.getAgents(),
      ])
      logger.info('Catalog cache warmed', { skills: skills.length, agents: agents.length })
    } catch (err) {
      logger.warn('Catalog cache warm failed', { error: (err as Error).message })
    }
  }

  async refresh(): Promise<{ skills: number; agents: number }> {
    skillsCache = null
    javaSkillsCache = null
    agentsCache = null
    const [skills, agents] = await Promise.all([this.getSkills(), this.getAgents()])
    return { skills: skills.length, agents: agents.length }
  }
}

export const catalogService = new CatalogService()
