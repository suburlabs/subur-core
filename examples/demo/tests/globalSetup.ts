// Una base subur_test_<pid> per execució, migrada amb el binari del paquet des de la demo
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import pg from 'pg'

const DEMO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const withDatabase = (url: string, name: string) => Object.assign(new URL(url), { pathname: `/${name}` }).toString()
const run = async (url: string, sql: string) => {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try { await client.query(sql) } finally { await client.end() }
}

/** La base de la demo: el seu .env mana si existeix (local, D16); si no, la del job (CI). */
export function demoDatabaseUrl(dir: string, env: NodeJS.ProcessEnv): string {
  const file = path.join(dir, '.env')
  const fromFile = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')).DATABASE_URL : undefined
  const url = fromFile ?? env.DATABASE_URL
  if (!url) throw new Error("demo: falta examples/demo/.env (cp .env.example .env) o DATABASE_URL a l'entorn del job")
  return url
}

export default async function setup(): Promise<() => Promise<void>> {
  // La resta del .env sense sobreescriure l'entorn, com el CLI; la base no en surt d'aquí sinó de demoDatabaseUrl.
  if (existsSync(path.join(DEMO, '.env'))) process.loadEnvFile(path.join(DEMO, '.env'))
  process.env.SUBUR_SECRET ??= 'test-only-secret'   // la configuració del motor l'exigeix; mai cap valor real
  // Els fitxers propietat del nucli no es versionen: sync els escriu abans de la base (spec §4.2; pla E2, R15).
  execFileSync('pnpm', ['-s', 'exec', 'subur', 'sync'], { cwd: DEMO, stdio: 'inherit' })
  const devUrl = demoDatabaseUrl(DEMO, process.env)
  const name = `subur_test_${process.pid}`
  const admin = withDatabase(devUrl, 'postgres')
  await run(admin, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
  await run(admin, `CREATE DATABASE "${name}"`)
  process.env.DATABASE_URL = withDatabase(devUrl, name)
  try {
    execFileSync('pnpm', ['-s', 'exec', 'subur', 'migrate'], { cwd: DEMO, env: process.env, stdio: 'inherit' })
  } catch (error) {
    await run(admin, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
    throw error
  }
  return async () => run(admin, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
}
