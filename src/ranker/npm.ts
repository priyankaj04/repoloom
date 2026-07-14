import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SkillManifest, SkillPackage } from '../types.js'

function getBundledSkillsDir(): string {
  const thisFile = fileURLToPath(import.meta.url)
  // compiled to dist/ranker/npm.js — two levels up reaches package root
  return path.join(path.dirname(thisFile), '../../skills')
}

export function searchSkillPackages(): Promise<SkillPackage[]> {
  return Promise.resolve(loadBundledSkills())
}

export function loadBundledSkills(): SkillPackage[] {
  const skillsDir = getBundledSkillsDir()
  if (!fs.existsSync(skillsDir)) return []

  const results: SkillPackage[] = []
  for (const entry of fs.readdirSync(skillsDir)) {
    if (!entry.startsWith('repoloom-skill-')) continue
    const dir = path.join(skillsDir, entry)
    const manifestPath = path.join(dir, 'skill.json')
    const pkgPath = path.join(dir, 'package.json')
    if (!fs.existsSync(manifestPath)) continue
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as SkillManifest
      const pkg = fs.existsSync(pkgPath)
        ? (JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string })
        : {}
      results.push({
        packageName: entry,
        manifest,
        npmVersion: pkg.version ?? '1.0.0',
        localPath: dir,
      })
    } catch {
      // skip malformed skill
    }
  }
  return results
}

export function findBundledSkill(packageName: string): string | null {
  const dir = path.join(getBundledSkillsDir(), packageName)
  return fs.existsSync(dir) ? dir : null
}
