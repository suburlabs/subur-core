import config from '../fixtures/app/src/payload.config.js'
import { getPayload, type Payload } from 'payload'
import { createServer, type AddressInfo, type Server } from 'node:net'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getConsentBackend } from '../../src/consent/backend.js'
import { runPurge } from '../../src/consent/purgeTask.js'
import {
  CONSENT_PROOF_RETENTION_YEARS,
  CONSENT_VALIDITY_DAYS,
  purgeExpiredConsent,
} from '../../src/consent/retention.js'

/**
 * Retenció dels registres de consentiment (spec §22.6), sobre la base
 * efímera: les taules `c15t_*` les hi ha posat la migració d'H2. Les files
 * s'insereixen amb SQL directe (columnes i `NOT NULL` de
 * `src/migrations/20260926_090554_c15t.ts`); les dates són `timestamp
 * without time zone`, com les escriu c15t.
 */
const NOW = new Date('2030-06-01T00:00:00Z')
const DOMAIN = 'dom_retentiontest'

const SUBJECTS = [
  'sub_old',
  'sub_null',
  'sub_recent',
  'sub_mixed',
  'sub_edgekeep',
  'sub_edgedrop',
  'sub_edgenullkeep',
  'sub_edgenulldrop',
  'sub_expiry',
  'sub_trigger',
]

let client: pg.Client

const subject = (id: string, createdAt: string) =>
  client.query(
    `insert into c15t_subject (id, "createdAt", "updatedAt") values ($1, $2::timestamp, $2::timestamp)`,
    [id, createdAt],
  )
const consent = (id: string, subjectId: string, givenAt: string, validUntil: null | string) =>
  client.query(
    `insert into c15t_consent (id, "subjectId", "domainId", "purposeIds", "givenAt", "validUntil")
     values ($1, $2, $3, '[]'::json, $4::timestamp, $5::timestamp)`,
    [id, subjectId, DOMAIN, givenAt, validUntil],
  )
const auditLog = (id: string, subjectId: string, createdAt: string) =>
  client.query(
    `insert into "c15t_auditLog" (id, "entityType", "entityId", "actionType", "subjectId", "createdAt")
     values ($1, 'consent', $2, 'create_consent', $3, $4::timestamp)`,
    [id, id, subjectId, createdAt],
  )

const ids = async (table: string, column = 'id') => {
  const { rows } = await client.query<{ v: string }>(
    `select ${column} as v from ${table} where "${table === 'c15t_subject' ? 'id' : 'subjectId'}" = any($1) order by 1`,
    [SUBJECTS],
  )
  return rows.map((r) => r.v)
}

/** Com ho farà la tasca: dins d'una transacció. */
const purgeInTransaction = async (now: Date) => {
  await client.query('begin')
  try {
    const counts = await purgeExpiredConsent(client, now)
    await client.query('commit')
    return counts
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

const cleanup = async () => {
  await client.query(`drop trigger if exists retention_test_boom on c15t_consent`)
  await client.query(`drop function if exists retention_test_boom()`)
  await client.query(`delete from "c15t_auditLog" where "subjectId" = any($1)`, [SUBJECTS])
  await client.query(`delete from c15t_consent where "subjectId" = any($1)`, [SUBJECTS])
  await client.query(`delete from c15t_subject where id = any($1)`, [SUBJECTS])
  await client.query(`delete from c15t_domain where id = $1`, [DOMAIN])
}

describe('retenció dels consentiments', () => {
  beforeAll(async () => {
    client = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    await cleanup()
    await client.query(`insert into c15t_domain (id, name) values ($1, 'retention.test')`, [DOMAIN])
  })

  afterAll(async () => {
    await cleanup()
    await client.end()
  })

  it('les constants són les de la spec', () => {
    expect(CONSENT_VALIDITY_DAYS).toBe(365)
    expect(CONSENT_PROOF_RETENTION_YEARS).toBe(3)
  })

  it('esborra el que ha caducat fa més de tres anys, en l’ordre de les claus foranes', async () => {
    await subject('sub_old', '2025-01-01')
    await consent('cns_old', 'sub_old', '2025-01-01', '2026-01-01')
    await auditLog('log_old', 'sub_old', '2025-01-01')

    // Sense `validUntil`: compta com `givenAt + 365 dies`.
    await subject('sub_null', '2025-05-01')
    await consent('cns_null', 'sub_null', '2025-05-01', null)

    await subject('sub_recent', '2027-01-01')
    await consent('cns_recent', 'sub_recent', '2027-01-01', '2028-01-01')
    await auditLog('log_recent', 'sub_recent', '2027-01-01')

    await subject('sub_mixed', '2025-01-01')
    await consent('cns_mixed_old', 'sub_mixed', '2025-01-01', '2026-01-01')
    await consent('cns_mixed_new', 'sub_mixed', '2029-01-01', '2030-01-01')
    await auditLog('log_mixed', 'sub_mixed', '2025-01-01')

    const counts = await purgeInTransaction(NOW)

    expect(counts).toEqual({ auditLogs: 2, consents: 3, subjects: 2 })
    expect(await ids('c15t_consent')).toEqual(['cns_mixed_new', 'cns_recent'])
    expect(await ids('"c15t_auditLog"')).toEqual(['log_recent'])
    expect(await ids('c15t_subject')).toEqual(['sub_mixed', 'sub_recent'])
  })

  it('el límit és exactament tres anys després de la caducitat (un dia abans es queda, un dia després no)', async () => {
    // NOW - 3 anys = 2027-06-01; per als registres sense `validUntil`, un
    // `givenAt` de 2026-06-01 caduca just aquell dia (365 dies, sense 29 de
    // febrer entremig). Les files del cas anterior ja no han de comptar.
    await subject('sub_edgekeep', '2026-06-02')
    await consent('cns_edgekeep', 'sub_edgekeep', '2026-06-02', '2027-06-02')
    await auditLog('log_edgekeep', 'sub_edgekeep', '2026-06-02')

    await subject('sub_edgedrop', '2026-05-31')
    await consent('cns_edgedrop', 'sub_edgedrop', '2026-05-31', '2027-05-31')
    await auditLog('log_edgedrop', 'sub_edgedrop', '2026-05-31')

    await subject('sub_edgenullkeep', '2026-06-02')
    await consent('cns_edgenullkeep', 'sub_edgenullkeep', '2026-06-02', null)

    await subject('sub_edgenulldrop', '2026-05-31')
    await consent('cns_edgenulldrop', 'sub_edgenulldrop', '2026-05-31', null)

    const counts = await purgeInTransaction(NOW)

    expect(counts).toEqual({ auditLogs: 1, consents: 2, subjects: 2 })
    expect(await ids('c15t_consent')).toEqual([
      'cns_edgekeep',
      'cns_edgenullkeep',
      'cns_mixed_new',
      'cns_recent',
    ])
    expect(await ids('"c15t_auditLog"')).toEqual(['log_edgekeep', 'log_recent'])
    expect(await ids('c15t_subject')).toEqual([
      'sub_edgekeep',
      'sub_edgenullkeep',
      'sub_mixed',
      'sub_recent',
    ])
  })

  it('la política de c15t deixa validUntil = givenAt + CONSENT_VALIDITY_DAYS en cada registre nou', async () => {
    const origin = 'http://localhost:3000'
    const res = await getConsentBackend().handler(
      new Request(`${origin}/api/c15t/subjects`, {
        body: JSON.stringify({
          domain: 'localhost',
          givenAt: Date.now(),
          preferences: { measurement: false, necessary: true },
          subjectId: 'sub_expiry',
          type: 'cookie_banner',
        }),
        headers: { 'content-type': 'application/json', origin },
        method: 'POST',
      }),
    )
    expect(res.status).toBeLessThan(300)
    const { rows } = await client.query<{ days: number }>(
      `select extract(epoch from "validUntil" - "givenAt") / 86400 as days
         from c15t_consent where "subjectId" = 'sub_expiry'`,
    )
    expect(rows.map((r) => Number(r.days))).toEqual([CONSENT_VALIDITY_DAYS])
  })
})

describe('tasca purgeExpiredConsent del motor', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  it('està registrada amb el cron diari a la cua maintenance, i l’autoRun mira aquella cua', () => {
    const task = payload.config.jobs.tasks?.find((t) => t.slug === 'purgeExpiredConsent')
    expect(task?.schedule).toEqual([{ cron: '30 3 * * *', queue: 'maintenance' }])
    expect(payload.config.jobs.autoRun).toEqual([
      { cron: '*/10 * * * *', queue: 'maintenance' },
      { cron: '* * * * *', queue: 'default' },
    ])
  })

  it('s’executa des de la cua, acaba sense error i registra només els tres comptadors', async () => {
    const info = vi.spyOn(payload.logger, 'info')
    try {
      const job = await payload.jobs.queue({ input: {}, queue: 'maintenance', task: 'purgeExpiredConsent' })
      const result = await payload.jobs.run({ queue: 'maintenance' })

      expect(result.jobStatus?.[String(job.id)]?.status).toBe('success')
      // `deleteJobOnComplete` és `true` per defecte al motor
      // (`payload/dist/config/defaults.js`): una execució completada no deixa
      // fila a la cua. El registre és la traça.
      const left = await payload.find({
        collection: 'payload-jobs',
        where: { id: { equals: job.id } },
      })
      expect(left.totalDocs).toBe(0)

      const ours = info.mock.calls.filter((args) => JSON.stringify(args).includes('purgeExpiredConsent'))
      expect(ours).toHaveLength(1)
      // Una sola línia, i res més que els tres comptadors.
      expect(ours[0]).toHaveLength(1)
      expect(ours[0][0]).toMatch(
        /^purgeExpiredConsent: esborrats consents=\d+ auditLogs=\d+ subjects=\d+$/,
      )
    } finally {
      info.mockRestore()
    }
  })

  it('si falla, la fila es queda amb l’error net i el registre del motor no porta la connection string', async () => {
    const error = vi.spyOn(payload.logger, 'error')
    const realUrl = process.env.DATABASE_URL
    let jobId: number | string | undefined
    try {
      process.env.DATABASE_URL = 'postgres://ningu:contrasenya-secreta@127.0.0.1:1/cap'
      const job = await payload.jobs.queue({ input: {}, queue: 'maintenance', task: 'purgeExpiredConsent' })
      jobId = job.id
      const result = await payload.jobs.run({ queue: 'maintenance' })
      process.env.DATABASE_URL = realUrl

      expect(result.jobStatus?.[String(job.id)]?.status).not.toBe('success')
      const failed = await payload.findByID({ collection: 'payload-jobs', id: job.id })
      // `hasError` i `error` omplerts: el motor ja no la compta com a activa
      // i en programarà una altra.
      expect(failed.hasError).toBe(true)
      expect((failed.error as { message?: string }).message).toBe(
        "purgeExpiredConsent: la purga ha fallat (ECONNREFUSED); no s'ha esborrat res",
      )
      expect(JSON.stringify(failed)).not.toContain('contrasenya-secreta')
      expect(error).toHaveBeenCalled()
      expect(JSON.stringify(error.mock.calls)).not.toContain('contrasenya-secreta')
    } finally {
      process.env.DATABASE_URL = realUrl
      error.mockRestore()
      if (jobId !== undefined) await payload.delete({ collection: 'payload-jobs', id: jobId })
    }
  })
})

/**
 * Com falla la purga (revisió de la Tasca 5): sempre dins d'un termini curt,
 * i amb un error que no porta res del que ha fallat per dins (el motor el
 * registra sencer i el desa a la fila de la cua).
 */
const expectSafeFailure = (error: unknown, code: string) => {
  expect(error).toBeInstanceOf(Error)
  const err = error as Error & Record<string, unknown>
  expect(err.message).toBe(`purgeExpiredConsent: la purga ha fallat (${code}); no s'ha esborrat res`)
  // Ni `detail`, ni `code`, ni `cause`, ni cap altra propietat de l'original.
  expect(Object.keys(err)).toEqual([])
  expect(err.cause).toBeUndefined()
}

const failureOf = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('la purga no ha fallat')
}

describe('purga: errors i terminis', () => {
  beforeAll(async () => {
    client = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    await cleanup()
    await client.query(`insert into c15t_domain (id, name) values ($1, 'retention.test')`, [DOMAIN])
  })

  afterAll(async () => {
    await cleanup()
    await client.end()
  })

  it('una connexió rebutjada surt amb un error net, sense la connection string', async () => {
    const error = await failureOf(
      runPurge({ connectionString: 'postgres://ningu:contrasenya-secreta@127.0.0.1:1/cap' }),
    )
    expectSafeFailure(error, 'ECONNREFUSED')
    expect(String((error as Error).stack)).not.toContain('contrasenya-secreta')
  })

  it('un servidor que accepta la connexió i no respon talla al termini de connexió', async () => {
    const silent: Server = createServer(() => {})
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve))
    const { port } = silent.address() as AddressInfo
    try {
      const started = Date.now()
      const error = await failureOf(
        runPurge({ connectionString: `postgres://u:p@127.0.0.1:${port}/x`, connectTimeoutMs: 300 }),
      )
      expect(Date.now() - started).toBeLessThan(3_000)
      expectSafeFailure(error, 'sense codi')
    } finally {
      silent.close()
    }
  })

  it('un delete bloquejat per una altra transacció talla al termini de sentència i no esborra res', async () => {
    await subject('sub_trigger', '2020-01-01')
    await consent('cns_trigger', 'sub_trigger', '2020-01-01', '2021-01-01')
    const locker = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await locker.connect()
    try {
      await locker.query('begin')
      await locker.query('lock table c15t_consent in access exclusive mode')
      const started = Date.now()
      const error = await failureOf(
        runPurge({ connectionString: process.env.DATABASE_URL, now: NOW, statementTimeoutMs: 300 }),
      )
      expect(Date.now() - started).toBeLessThan(3_000)
      // 57014: query_canceled (el `statement_timeout` del servidor).
      expectSafeFailure(error, '57014')
    } finally {
      await locker.query('rollback')
      await locker.end()
    }
    expect(await ids('c15t_consent')).toContain('cns_trigger')
  })

  it('un error de Postgres amb un subjectId al missatge i al detail no el deixa sortir, i desfà la transacció', async () => {
    // Un disparador que falla en esborrar la fila de prova, amb el
    // `subjectId` al missatge i al `detail`, com ho faria una clau forana.
    await client.query(`
      create function retention_test_boom() returns trigger language plpgsql as $$
      begin
        if old."subjectId" = 'sub_trigger' then
          raise exception 'no es pot esborrar %', old."subjectId"
            using detail = format('Key (id)=(%s)', old."subjectId");
        end if;
        return old;
      end $$`)
    await client.query(
      `create trigger retention_test_boom before delete on c15t_consent
         for each row execute function retention_test_boom()`,
    )
    // Una altra fila caducada que el mateix `delete` s'enduria: després de
    // l'error hi ha de continuar.
    await subject('sub_edgedrop', '2020-01-01')
    await consent('cns_edgedrop', 'sub_edgedrop', '2020-01-01', '2021-01-01')

    const error = await failureOf(runPurge({ connectionString: process.env.DATABASE_URL, now: NOW }))

    // P0001: raise_exception.
    expectSafeFailure(error, 'P0001')
    expect(String((error as Error).stack)).not.toContain('sub_trigger')
    expect(await ids('c15t_consent')).toEqual(['cns_edgedrop', 'cns_trigger'])
  })
})
