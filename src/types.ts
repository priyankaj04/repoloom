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
  relevance: number        // 1-10: how much this stack needs it
  usefulness: number       // 1-10: day-to-day value
  quality: number          // 1-10: content/packaging quality
  overall: number          // weighted average
  incrementalValue: number // 1-10: value added BEYOND what's already installed — the key metric
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
