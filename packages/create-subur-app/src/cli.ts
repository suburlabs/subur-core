// core/packages/create-subur-app/src/cli.ts — el punt d'entrada: `create-subur-app <dir> …` i `create-subur-app update [<dir>]`
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CliError, parseCreate, USAGE } from './args.js'
import { create, CreateFailed, recoveryHint } from './create.js'
import { update } from './update.js'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const version = (JSON.parse(readFileSync(path.join(PKG, 'package.json'), 'utf8')) as { version: string }).version
const argv = process.argv.slice(2)
const [first, ...rest] = argv

/** Els errors de `parseArgs` (opció desconeguda, valor absent…) són errors d'ús: la línia d'ús, mai una traça. */
const isParseArgsError = (error: unknown) => error instanceof TypeError && /^ERR_PARSE_ARGS_/.test((error as { code?: string }).code ?? '')

try {
  if (first === undefined) {
    console.error(USAGE)
    process.exit(2)
  } else if (first === '--help' || first === '-h') {
    console.log(USAGE)
  } else if (first === 'update') {
    if (rest[0] === '--help' || rest[0] === '-h') console.log(USAGE)
    else if (rest.length > 1) throw new CliError(USAGE)
    else update(path.resolve(rest[0] ?? '.'))
  } else {
    const created = create(parseCreate(argv, version), console.log)
    console.log(`Fet: ${created.dir} (@suburlabs/core ${created.coreVersion})`)
    console.log('Queda a mà:')
    for (const item of created.pending) console.log(`  - ${item}`)
  }
} catch (error) {
  // A mitges (el directori ja té coses, o el repositori de GitHub ja existeix): el motiu i com sortir-ne; sempre codi 1.
  if (error instanceof CreateFailed) {
    console.error(error.message)
    console.error(recoveryHint(error.stage, error.dir, error.repo))
    process.exit(1)
  }
  if (isParseArgsError(error)) {
    console.error(`${(error as Error).message}\n${USAGE}`)
    process.exit(2)
  }
  // CliError: 2 (ús) o el codi que porti; la resta, 1.
  console.error(error instanceof Error ? error.message : String(error))
  process.exit((error as { exitCode?: number }).exitCode ?? 1)
}
