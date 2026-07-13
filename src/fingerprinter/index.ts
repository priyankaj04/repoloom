import fs from 'node:fs'
import path from 'node:path'
import type { ProjectFingerprint } from '../types.js'

const LOCAL_SKILLS_SUBDIR = path.join('.claude', 'skills')

export function fingerprint(projectDir: string): ProjectFingerprint {
  return {
    packageManagers: detectPackageManagers(projectDir),
    ...detectStack(projectDir),
    ciProvider: detectCI(projectDir),
    isMonorepo: detectMonorepo(projectDir),
    installedSkills: detectInstalledSkills(projectDir),
  }
}

function detectPackageManagers(dir: string): string[] {
  const managers: string[] = []
  if (exists(dir, 'package.json')) managers.push('npm')
  if (exists(dir, 'pyproject.toml') || exists(dir, 'requirements.txt')) managers.push('pip')
  if (exists(dir, 'Cargo.toml')) managers.push('cargo')
  if (exists(dir, 'go.mod')) managers.push('go')
  if (exists(dir, 'pom.xml') || exists(dir, 'build.gradle')) managers.push('maven')
  return managers
}

function detectStack(dir: string): {
  languages: string[]
  frameworks: string[]
  testFrameworks: string[]
} {
  const languages: string[] = []
  const frameworks: string[] = []
  const testFrameworks: string[] = []

  const pkg = readJson(dir, 'package.json')
  if (pkg) {
    languages.push('javascript')
    const deps = {
      ...(pkg.dependencies as Record<string, string> | undefined),
      ...(pkg.devDependencies as Record<string, string> | undefined),
    }
    if (deps['typescript']) languages.push('typescript')
    if (deps['react']) frameworks.push('react')
    if (deps['next']) frameworks.push('nextjs')
    if (deps['vue']) frameworks.push('vue')
    if (deps['svelte']) frameworks.push('svelte')
    if (deps['express']) frameworks.push('express')
    if (deps['fastify']) frameworks.push('fastify')
    if (deps['vitest']) testFrameworks.push('vitest')
    if (deps['jest']) testFrameworks.push('jest')
  }

  const requirements = readLines(dir, 'requirements.txt')
  const pyprojectRaw = readRaw(dir, 'pyproject.toml')
  if (requirements.length > 0 || pyprojectRaw) {
    languages.push('python')
    const allPy = requirements.concat(pyprojectRaw ? [pyprojectRaw] : []).join('\n')
    if (/\bfastapi\b/i.test(allPy)) frameworks.push('fastapi')
    if (/\bdjango\b/i.test(allPy)) frameworks.push('django')
    if (/\bflask\b/i.test(allPy)) frameworks.push('flask')
    if (/\bpytest\b/i.test(allPy)) testFrameworks.push('pytest')
  }

  if (exists(dir, 'Cargo.toml')) languages.push('rust')
  if (exists(dir, 'go.mod')) languages.push('go')

  return { languages, frameworks, testFrameworks }
}

function detectCI(dir: string): string | null {
  if (exists(dir, '.github/workflows')) return 'github-actions'
  if (exists(dir, '.circleci')) return 'circleci'
  if (exists(dir, 'Jenkinsfile')) return 'jenkins'
  if (exists(dir, '.gitlab-ci.yml')) return 'gitlab-ci'
  return null
}

function detectMonorepo(dir: string): boolean {
  const pkg = readJson(dir, 'package.json')
  return !!(
    pkg?.workspaces ||
    exists(dir, 'pnpm-workspace.yaml') ||
    exists(dir, 'lerna.json')
  )
}

function detectInstalledSkills(dir: string): string[] {
  const skills: string[] = []
  const localDir = path.join(dir, LOCAL_SKILLS_SUBDIR)
  if (fs.existsSync(localDir)) {
    skills.push(
      ...fs.readdirSync(localDir).filter(d => d.startsWith('repoloom-skill-'))
    )
  }
  return [...new Set(skills)]
}

function exists(dir: string, rel: string): boolean {
  return fs.existsSync(path.join(dir, rel))
}

function readJson(dir: string, rel: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function readLines(dir: string, rel: string): string[] {
  try {
    return fs.readFileSync(path.join(dir, rel), 'utf8').split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function readRaw(dir: string, rel: string): string | null {
  try {
    return fs.readFileSync(path.join(dir, rel), 'utf8')
  } catch {
    return null
  }
}
