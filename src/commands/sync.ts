import ora from 'ora'
import { sync } from '../installer/index.js'

export async function syncCommand(): Promise<void> {
  const spinner = ora('Syncing skills from repoloom.lock...').start()
  try {
    sync(process.cwd())
    spinner.succeed('Skills synced')
  } catch (err) {
    spinner.fail((err as Error).message)
    process.exit(1)
  }
}
