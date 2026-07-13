import fs from 'node:fs'
import path from 'node:path'
import prompts from 'prompts'

export async function scaffold(targetDir: string): Promise<void> {
  const answers = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Skill name (e.g. react, fastapi, rust):',
      validate: (v: string) => /^[a-z0-9-]+$/.test(v) || 'Use lowercase letters, numbers, hyphens',
    },
    { type: 'text', name: 'description', message: 'One-line description:' },
    { type: 'list', name: 'tags', message: 'Stack tags (comma-separated, e.g. react,typescript):' },
    {
      type: 'list',
      name: 'deps',
      message: 'Trigger dependencies (comma-separated npm/pip package names):',
    },
  ])

  if (!answers.name) {
    console.log('Cancelled.')
    return
  }

  const pkgName = `repoloom-skill-${answers.name as string}`
  const skillDir = path.join(targetDir, pkgName)
  fs.mkdirSync(skillDir, { recursive: true })

  const manifest = {
    name: answers.name,
    description: answers.description,
    tags: answers.tags,
    triggers: { dependencies: answers.deps },
    targets: ['claude-code'],
    version: '1.0.0',
  }

  fs.writeFileSync(path.join(skillDir, 'skill.json'), JSON.stringify(manifest, null, 2) + '\n')
  fs.writeFileSync(
    path.join(skillDir, 'skill.md'),
    `# ${answers.name as string}\n\nWrite your Claude Code skill instructions here.\n`
  )
  fs.writeFileSync(
    path.join(skillDir, 'package.json'),
    JSON.stringify(
      {
        name: pkgName,
        version: '1.0.0',
        description: answers.description,
        main: 'skill.md',
        files: ['skill.md', 'skill.json'],
        keywords: ['repoloom-skill', ...(answers.tags as string[])],
        license: 'MIT',
      },
      null,
      2
    ) + '\n'
  )
  fs.writeFileSync(
    path.join(skillDir, 'README.md'),
    `# ${pkgName}\n\n${answers.description as string}\n\n## Tags\n\n${(answers.tags as string[]).join(', ')}\n`
  )

  console.log(`\nScaffolded: ${skillDir}`)
  console.log(`Edit skill.md, then run:\n  cd ${pkgName} && npx repoloom publish`)
}
