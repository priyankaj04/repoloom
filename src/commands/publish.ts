import fs from 'node:fs'
import path from 'node:path'
import { validate, publish } from '../publisher/index.js'
import { scaffold } from '../publisher/scaffold.js'

export async function publishCommand(): Promise<void> {
  const cwd = process.cwd()
  const hasSkillJson = fs.existsSync(path.join(cwd, 'skill.json'))

  if (hasSkillJson) {
    try {
      publish(cwd)
      console.log('Published successfully.')
    } catch (err) {
      console.error((err as Error).message)
      process.exit(1)
    }
  } else {
    await scaffold(cwd)
  }
}
