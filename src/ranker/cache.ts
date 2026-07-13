import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { ProjectFingerprint, RankedSkill } from '../types.js'

function cacheDir(): string {
  return path.join(process.env.HOME!, '.repoloom', 'cache')
}

export function getCacheKey(fingerprint: ProjectFingerprint): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(fingerprint))
    .digest('hex')
    .slice(0, 16)
}

export function readCache(key: string): RankedSkill[] | null {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(cacheDir(), `${key}.json`), 'utf8')
    ) as RankedSkill[]
  } catch {
    return null
  }
}

export function writeCache(key: string, skills: RankedSkill[]): void {
  const dir = cacheDir()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(skills, null, 2))
}
