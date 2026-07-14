import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
interface SkillManifest {
  name: string
  description: string
  tags: string[]
  triggers: { dependencies?: string[]; files?: string[] }
  targets: string[]
  version: string
}

const REQUIRED_FIELDS: (keyof SkillManifest)[] = [
  'name', 'description', 'tags', 'targets', 'version',
]
const NAME_PATTERN = /^(@[\w-]+\/)?repoloom-skill-/

export function validate(dir: string): void {
  const pkgPath = path.join(dir, 'package.json')
  const manifestPath = path.join(dir, 'skill.json')
  const skillPath = path.join(dir, 'skill.md')

  if (!fs.existsSync(pkgPath)) throw new Error('package.json not found')
  if (!fs.existsSync(manifestPath)) throw new Error('skill.json not found')
  if (!fs.existsSync(skillPath)) throw new Error('skill.md not found')

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name: string }
  if (!NAME_PATTERN.test(pkg.name)) {
    throw new Error(
      `Package name must match repoloom-skill-* or @scope/repoloom-skill-*, got: ${pkg.name}`
    )
  }

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf8')
  ) as Partial<SkillManifest>

  for (const field of REQUIRED_FIELDS) {
    if (!manifest[field]) throw new Error(`skill.json missing required field: ${field}`)
  }

  const triggers = manifest.triggers ?? {}
  if (!triggers.dependencies?.length && !triggers.files?.length) {
    throw new Error('skill.json triggers must have at least one dependency or file entry')
  }

  const skillContent = fs.readFileSync(skillPath, 'utf8').trim()
  if (!skillContent) throw new Error('skill.md is empty')
}

export function publish(dir: string): void {
  validate(dir)

  const pkgPath = path.join(dir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>
  pkg['repoloom'] = JSON.parse(fs.readFileSync(path.join(dir, 'skill.json'), 'utf8'))
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

  execSync('npm publish', { cwd: dir, stdio: 'inherit' })
}
