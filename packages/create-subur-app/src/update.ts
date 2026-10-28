// core/packages/create-subur-app/src/update.ts — `create-subur-app update [<dir>]`: el `subur update` del nucli instal·lat al client
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { CliError } from './args.js'

export function update(dir: string): void {
  if (!existsSync(path.join(dir, 'node_modules/@suburlabs/core/bin/subur.js'))) throw new CliError(`${dir}: no hi ha @suburlabs/core instal·lat (pnpm install)`)
  try {
    execFileSync('pnpm', ['-s', 'exec', 'subur', 'update'], { cwd: dir, stdio: 'inherit' })
  } catch (error) {
    // El motiu ja és a stderr (stdio heretat): només en queda el codi. Un error d'ús del nucli (2) continua sent-ho.
    const status = (error as { status?: number | null }).status
    throw Object.assign(new Error(`subur update ha fallat (codi ${status ?? '?'})`), { exitCode: status === 2 ? 2 : 1 })
  }
}
