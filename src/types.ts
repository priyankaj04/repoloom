import type { CatalogEntry, Platform, SkillDetail } from './catalog/fetcher.js'

export type { CatalogEntry, Platform, SkillDetail }

export interface ProjectFingerprint {
  packageManagers: string[]
  languages: string[]
  frameworks: string[]
  testFrameworks: string[]
  ciProvider: string | null
  isMonorepo: boolean
  installedSkills: string[]
}

export interface RankedSkill extends CatalogEntry {
  rank: number
  explanation: string
  relevance: number   // 1-10
  usefulness: number  // 1-10
  quality: number     // 1-10
  overall: number     // weighted average
}

export type SkillType = 'skill' | 'plugin' | 'mcp-server' | 'unknown'
export type AIPlatform = 'claude-code' | 'codex-cli' | 'gemini-cli' | 'cursor' | 'copilot'

export interface LockFile {
  version: 2
  skills: Record<string, string>  // slug → githubUrl (platform-agnostic)
}

export interface InstallOptions {
  mode: 'global' | 'local'
  force?: boolean
}
