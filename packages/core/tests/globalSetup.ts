// Una base subur_test_<pid> per execució, migrada amb el binari
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const withDatabase = (url: string, name: string) => Object.assign(new URL(url), { pathname: `/${name}` }).toString()
const run = async (url: string, sql: string) => {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try { await client.query(sql) } finally { await client.end() }
}

export default async function setup(): Promise<() => Promise<void>> {
  if (existsSync(path.join(PKG, '.env'))) process.loadEnvFile(path.join(PKG, '.env'))
  process.env.SUBUR_SECRET ??= 'test-only-secret'   // la configuració del motor l'exigeix; mai cap valor real
  // El superadministrador «real» de la base de proves, el que `ensureSuperAdmin` crea en arrencar (com el .env de
  // l'arrel): proves com `subscription` i `redirectsAccess` hi compten. Mai cap valor real.
  process.env.SUBUR_ADMIN_EMAIL ??= 'admin@subur.dev'
  process.env.SUBUR_ADMIN_PASSWORD ??= 'test-only-password'
  const devUrl = process.env.DATABASE_URL
  if (!devUrl) throw new Error('vitest: falta DATABASE_URL (Global Constraints: el Postgres de docker-compose.dev.yml)')
  const name = `subur_test_${process.pid}`
  const admin = withDatabase(devUrl, 'postgres')
  await run(admin, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
  await run(admin, `CREATE DATABASE "${name}"`)
  process.env.DATABASE_URL = withDatabase(devUrl, name)
  try {
    execFileSync(process.execPath, [path.join(PKG, 'bin/subur.js'), 'migrate'], { cwd: path.join(PKG, 'tests/fixtures/app'), env: process.env, stdio: 'inherit' })
  } catch (error) {
    await run(admin, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
    throw error
  }
  return async () => run(admin, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
}
