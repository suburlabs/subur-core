import { existsSync } from 'node:fs'
import path from 'node:path'

import { loadClientConfig, loadFacts } from './loadClient.js'
import { migrateStatus, migrateUp } from './migrate.js'

const USAGE = 'ús: subur facts --json | subur sync | subur check | subur update | subur migrate [--status] | subur gate --image <ref> --media-dir <dir> [--db-url <url>] [--base-url <url>] [--docker-net host|bridge]'
const cwd = process.cwd()
// Com el CLI del motor: el .env del cwd, sense sobreescriure l'entorn (C45, C80). Sonda: A=shell + .env A=file → «shell».
if (existsSync(path.join(cwd, '.env'))) process.loadEnvFile(path.join(cwd, '.env'))
const [command, ...rest] = process.argv.slice(2)

const usage = () => Object.assign(new Error(USAGE), { exitCode: 2 })

async function facts() {
  if (rest.length !== 1 || rest[0] !== '--json') throw usage()
  process.stdout.write(`${JSON.stringify(await loadFacts(cwd, (message) => console.error(`subur facts: ${message}`)))}\n`)
}

async function syncCommand() {
  if (rest.length !== 0) throw usage()
  const { sync } = await import('./sync.js')
  const { written, unchanged } = sync(cwd)
  console.log(`subur sync: ${written.length + unchanged.length} fitxers (${written.length} escrits)`)
}

async function checkCommand() {
  if (rest.length !== 0) throw usage()
  const { check } = await import('./check.js')
  const { count, problems, skipped } = await check(cwd)
  for (const line of skipped) console.log(`check: ${line}`)
  for (const p of problems) console.error(`check: ${p.check}: ${p.detail}`)
  if (problems.length > 0) throw Object.assign(new Error(`check: ${problems.length} problemes`), { exitCode: 1 })
  console.log(`check: ok (${count} comprovacions)`)
}

async function updateCommand() {
  if (rest.length !== 0) throw usage()
  const { summary, update } = await import('./update.js')
  console.log(summary(cwd, (await update(cwd)).changed))
}

async function migrate() {
  // Només «migrate» o «migrate --status»: qualsevol altre argument (--help, --dry-run…) aplicaria les migracions.
  const status = rest.length === 1 && rest[0] === '--status'
  if (rest.length > 0 && !status) throw usage()
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('subur migrate: falta DATABASE_URL (entorn o .env del cwd)'), { exitCode: 1 })
  // Amb SUBUR_RUN_MIGRATIONS=1 i NODE_ENV=production la configuració posaria prodMigrations i el motor migraria ja a init:
  // --status ha de ser de només lectura en qualsevol entorn (nit de la ronda 2).
  delete process.env.SUBUR_RUN_MIGRATIONS
  const config = await loadClientConfig(cwd)
  if (status) {
    const { pending } = await migrateStatus(config)
    console.log(pending.length ? `pendents: ${pending.length}\n${pending.join('\n')}` : 'cap pendent')
  } else {
    await migrateUp(config)
  }
}

try {
  if (command === 'facts') await facts()
  else if (command === 'migrate') await migrate()
  else if (command === 'sync') await syncCommand()
  else if (command === 'check') await checkCommand()
  else if (command === 'update') await updateCommand()
  // Mandrós: la porta (pg, docker) no es carrega per a `facts` ni `migrate`.
  else if (command === 'gate') await (await import('../gate/cli.js')).main(rest)
  else {
    console.error(USAGE)
    process.exit(2)
  }
  process.exit(0)
} catch (error) {
  // La porta ja ha imprès el seu motiu (pas, esperat, rebut): només en queda el codi de sortida.
  if (!(error as { reported?: boolean }).reported) console.error(error instanceof Error ? error.message : String(error))
  process.exit((error as { exitCode?: number }).exitCode ?? 1)
}
