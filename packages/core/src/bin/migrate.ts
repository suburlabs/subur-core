import payload, { type Config, type Migration, type SanitizedConfig } from 'payload'
import pg from 'pg'

import { migrations } from '../migrations/index.js'

export type MigrateStatus = { pending: string[] }

type Pool = { query: (text: string) => Promise<{ rows: Array<Record<string, unknown>> }> }

/**
 * Una instància mínima del motor, com el seu CLI: sense onInit (ensureSuperAdmin compta usuaris que encara no existeixen).
 * Els registres del motor van a stderr: stdout del binari només porta la resposta (D14; sonda S8: amb la configuració
 * per defecte el «WARN: No email adapter provided» surt a stdout, abans de «pendents: N»).
 */
async function open(config: SanitizedConfig) {
  process.env.PAYLOAD_MIGRATING = 'true'
  // El tipus sanejat exigeix totes les opcions de pino; init passa config.logger a getLogger, que accepta la forma de Config.
  const logger: Config['logger'] = { destination: process.stderr, options: { level: 'warn' } }
  await payload.init({ config: { ...config, logger } as unknown as SanitizedConfig, disableOnInit: true })
  return payload
}

/**
 * L'adaptador de Postgres crea la base si no existeix (disableCreateDatabase és false per defecte): --status ho ha de
 * saber abans d'iniciar el motor. Qualsevol altre error de connexió el deixa al motor, amb el missatge de sempre.
 */
async function assertDatabaseExists(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  try {
    await client.connect()
  } catch (error) {
    if ((error as { code?: string }).code === '3D000') throw new Error('la base de dades no existeix; `subur migrate --status` no en crea cap')
    return
  } finally {
    await client.end().catch(() => {})
  }
}

export async function migrateStatus(config: SanitizedConfig): Promise<MigrateStatus> {
  await assertDatabaseExists()
  const p = await open(config)
  try {
    const pool = (p.db as unknown as { pool: Pool }).pool
    const [{ t }] = (await pool.query("select to_regclass('public.payload_migrations') as t")).rows as Array<{ t: string | null }>
    const ran = new Set(t === null ? [] : (await pool.query('select name from payload_migrations')).rows.map((r) => String(r.name)))
    return { pending: migrations.filter((m) => !ran.has(m.name)).map((m) => m.name) }
  } finally {
    await p.destroy()
  }
}

export async function migrateUp(config: SanitizedConfig): Promise<void> {
  const p = await open(config)
  try {
    // Migration del motor tipa up/down amb (args: unknown): les del paquet, amb MigrateUpArgs, en són un subtipus.
    await p.db.migrate({ migrations: migrations as Migration[] })
  } finally {
    await p.destroy()
  }
}
