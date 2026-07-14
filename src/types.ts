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
}

export interface LockFile {
  version: 1
  skills: Record<string, string>
}

export interface InstallOptions {
  mode: 'global' | 'local'
  force?: boolean
}
