export interface ProjectFingerprint {
  packageManagers: string[]
  languages: string[]
  frameworks: string[]
  testFrameworks: string[]
  ciProvider: string | null
  isMonorepo: boolean
  installedSkills: string[]
}

export interface SkillManifest {
  name: string
  description: string
  tags: string[]
  triggers: {
    dependencies?: string[]
    files?: string[]
  }
  targets: string[]
  version: string
}

export interface SkillPackage {
  packageName: string
  manifest: SkillManifest
  npmVersion: string
  localPath?: string
}

export interface RankedSkill extends SkillPackage {
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
