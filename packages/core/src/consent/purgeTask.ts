import type { TaskConfig } from 'payload'
import pg from 'pg'

import { purgeExpiredConsent } from './retention.js'

type PurgeCounts = Awaited<ReturnType<typeof purgeExpiredConsent>>

/**
 * Terminis de la connexió de la purga, en segons i no en minuts. Una execució
 * que es queda penjada (una connexió que no respon, un `delete` bloquejat)
 * deixa la fila de la cua amb `processing = true` i sense error: el motor no
 * la torna a agafar mai (`runJobs` només vol `processing = false`) i, com que
 * la compta com a activa (`countRunnableOrActiveJobsForQueue`), no en
 * programa cap altra. Amb aquests terminis falla i queda registrada.
 * - `connectionTimeoutMillis`: arribar a Postgres i fer l'autenticació.
 * - `statement_timeout`: el servidor cancel·la qualsevol sentència més llarga
 *   (SQLSTATE 57014); també cobreix un bloqueig d'una altra transacció.
 * - `query_timeout`: el client deixa d'esperar una resposta que no arriba
 *   (xarxa tallada), una mica més llarg perquè guanyi el del servidor.
 * Opcions verificades a `pg@8.20.0` (`lib/connection-parameters.js`,
 * `lib/client.js`).
 */
export const PURGE_CONNECT_TIMEOUT_MS = 10_000
export const PURGE_STATEMENT_TIMEOUT_MS = 30_000

type RunPurgeArgs = {
  connectionString: string | undefined
  connectTimeoutMs?: number
  now?: Date
  statementTimeoutMs?: number
}

/**
 * L'error que surt de la purga porta només un missatge fix i el codi
 * (SQLSTATE de Postgres o el codi de sistema, com `ECONNREFUSED`). El motor
 * registra sencer l'error que llança una tasca (`handleTaskError`) i el desa
 * a la fila de la cua: l'original de `pg` pot portar a `detail` o al missatge
 * un `subjectId` (p. ex. `Key (id)=(sub_…)` en una clau forana), i el d'una
 * connexió, l'adreça del servidor. Per això no es reenvia ni com a `cause`.
 */
export const purgeFailure = (error: unknown): Error => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : 'sense codi'
  return new Error(
    `purgeExpiredConsent: la purga ha fallat (${code}); no s'ha esborrat res`,
  )
}

/**
 * Obre una connexió pròpia i curta sobre `connectionString` (com el backend
 * de c15t a `backend.ts`: no s'acobla al pool del CMS, i així el
 * `begin`/`commit` és d'aquesta connexió i de ningú més), fa la purga en una
 * transacció i tanca la connexió passi el que passi.
 */
export async function runPurge({
  connectionString,
  connectTimeoutMs = PURGE_CONNECT_TIMEOUT_MS,
  now = new Date(),
  statementTimeoutMs = PURGE_STATEMENT_TIMEOUT_MS,
}: RunPurgeArgs): Promise<PurgeCounts> {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: connectTimeoutMs,
    query_timeout: statementTimeoutMs + 5_000,
    statement_timeout: statementTimeoutMs,
  })
  // Sense listener, un error de connexió d'un `Client` inactiu és una
  // excepció no capturada que tomba el procés. Mentre hi ha una consulta en
  // curs, el mateix error la rebutja i arriba al `catch` de sota: aquí no cal
  // (ni convé) registrar-ne res més.
  client.on('error', () => {})
  try {
    await client.connect()
    await client.query('begin')
    try {
      const counts = await purgeExpiredConsent(client, now)
      await client.query('commit')
      return counts
    } catch (error) {
      // Si el `rollback` també falla (la connexió ja és morta), Postgres
      // desfà la transacció en tancar-se: que no amagui l'error original.
      await client.query('rollback').catch(() => {})
      throw error
    }
  } catch (error) {
    throw purgeFailure(error)
  } finally {
    await client.end().catch(() => {})
  }
}

/**
 * Purga diària dels consentiments caducats (spec §22.6). El `schedule` la
 * posa a la cua `maintenance` cada dia a les 03:30 (hora del procés) i
 * `jobs.autoRun` (`src/payload.config.ts`) l'executa.
 *
 * El registre porta només els tres comptadors: mai cap `subjectId`, IP ni la
 * connection string.
 */
export const purgeExpiredConsentTask: TaskConfig<{ input: object; output: PurgeCounts }> = {
  handler: async ({ req }) => {
    const counts = await runPurge({ connectionString: process.env.DATABASE_URL })
    // Els comptadors van dins del missatge, en una sola línia: el registre
    // del contenidor els mostra sencers amb `grep purgeExpiredConsent` (els
    // camps d'objecte, el format del motor els posa en línies a part).
    req.payload.logger.info(
      `purgeExpiredConsent: esborrats consents=${counts.consents} auditLogs=${counts.auditLogs} subjects=${counts.subjects}`,
    )
    return { output: counts }
  },
  schedule: [{ cron: '30 3 * * *', queue: 'maintenance' }],
  slug: 'purgeExpiredConsent',
}
