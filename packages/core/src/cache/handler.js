// src/cache/handler.js — cacheHandler de Next sobre el Postgres del client (spec §26).
//
// JavaScript pla (`export default class`): Next el carrega amb `import()` de
// l'standalone sense compilar-lo. Els tipus, a `handler.d.ts`.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'

import { decodeValue, encodeValue } from './codec.js'

export const ALL_TAG = '*'
const BUILD_PHASE = 'phase-production-build'
const RETRYABLE = new Set(['40P01', '40001'])

// Estat a escala de mòdul: Next crea una instància del handler per petició.
let pool = null
let buildId // undefined: no llegit; null: no hi és
let purged = false
const warnedInert = new Set() // motius ja avisats: 'dev', 'build', 'no hi ha .next/BUILD_ID'

// Només missatges: un error de pg pot portar la cadena de connexió (amb la contrasenya).
const warn = (line) => console.warn(`[cache] ${line}`)

function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      allowExitOnIdle: true,
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 2000,
      max: 2,
      query_timeout: 3000,
      statement_timeout: 3000,
    })
    // Sense listener, un error d'una connexió inactiva tomba el procés.
    pool.on('error', (error) => warn(`pool: ${error.message}`))
  }
  return pool
}

/** Tanca el pool (tests). */
export async function endPool() {
  const p = pool
  pool = null
  if (p) await p.end()
}

/** Només per als tests: oblida el BUILD_ID llegit, la bandera de purga i els avisos d'inert. */
export function resetModuleState() {
  buildId = undefined
  purged = false
  warnedInert.clear()
}

const inertOnce = (reason) => {
  if (warnedInert.has(reason)) return
  warnedInert.add(reason)
  warn(`inert: ${reason}`)
}

function readBuildId(serverDistDir) {
  if (buildId !== undefined) return buildId
  try {
    buildId = readFileSync(path.join(serverDistDir, '..', 'BUILD_ID'), 'utf8').trim() || null
  } catch {
    buildId = null
  }
  return buildId
}

const pageTags = (value) =>
  String(value?.headers?.['x-next-cache-tags'] ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
const uniq = (tags) => [...new Set(tags)].sort()
// Cada camí que prova un escàner seria una fila per sempre (spec §26.3).
const isRedirectOrError = (value) =>
  value?.kind === 'REDIRECT' || (value?.kind === 'APP_PAGE' && typeof value.status === 'number' && value.status >= 300)

export default class SuburCacheHandler {
  constructor(options = {}) {
    this.serverDistDir = options.serverDistDir ?? path.join(process.cwd(), '.next', 'server')
    this.inertReason = options.dev === true ? 'dev' : process.env.NEXT_PHASE === BUILD_PHASE ? 'build' : null
    this.startedAt = new Map() // key → ms (rellotge de Postgres), el mínim dels get d'aquella clau (spec §26.4)
    // Un sol avís per motiu, ja en construir: el build de Next instancia el handler sense cridar mai get/set.
    if (this.inertReason) inertOnce(this.inertReason)
  }

  /** `null` si cal quedar inert (i ho diu un cop per motiu); si no, el build. */
  build() {
    if (this.inertReason) {
      inertOnce(this.inertReason)
      return null
    }
    const id = readBuildId(this.serverDistDir)
    if (!id) inertOnce('no hi ha .next/BUILD_ID')
    return id
  }

  async get(key, ctx = {}) {
    const build = this.build()
    if (!build) return null
    try {
      // Una sola consulta per encert: la fila, l'instant de la base i si alguna
      // làpida (de la fila, de la petició o la global) és posterior a l'inici del treball.
      // `started_at` torna com a text: un `Date` de JS perdria els microsegons i
      // l'esborrat condicional de sota no trobaria la fila.
      const extra = uniq([...(ctx.tags ?? []), ...(ctx.softTags ?? []), ALL_TAG])
      const { rows } = await getPool().query(
        `select floor(extract(epoch from clock_timestamp()) * 1000) as now_ms, c.payload, c.started_at::text as started_at,
                floor(extract(epoch from c.last_modified) * 1000) as last_modified_ms,
                exists (select 1 from next_cache_tags t where t.tag = any(c.tags || $3::text[]) and t.invalidated_at > c.started_at) as dead
           from (select 1) s left join next_cache c on c.key = $1 and c.build = $2`,
        [key, build, extra],
      )
      const row = rows[0]
      this.startedAt.set(key, Math.min(this.startedAt.get(key) ?? Infinity, Number(row.now_ms)))
      if (!row.payload) return null
      if (row.dead) {
        // Només la fila llegida: una de més nova escrita entremig es queda.
        await getPool().query('delete from next_cache where key = $1 and build = $2 and started_at = $3::timestamptz', [
          key,
          build,
          row.started_at,
        ])
        return null
      }
      return { lastModified: Number(row.last_modified_ms), value: decodeValue(row.payload) }
    } catch (error) {
      // 42P01: taules encara no migrades (primera arrencada): miss silenciós.
      if (error.code !== '42P01') warn(`get failed: ${error.message}`)
      return null
    }
  }

  async set(key, data, ctx = {}) {
    const build = this.build()
    if (!build || !data || isRedirectOrError(data)) return
    const startedAt = this.startedAt.get(key)
    if (startedAt === undefined) return // sense get previ no hi ha cota: no s'escriu (spec §26.4)
    const tags = uniq(data.kind === 'FETCH' ? (ctx.tags ?? []) : pageTags(data))
    const rev = ctx.cacheControl?.revalidate ?? data.revalidate
    const revalidate = typeof rev === 'number' && Number.isFinite(rev) ? Math.floor(rev) : null
    try {
      if (!purged) {
        await getPool().query('delete from next_cache where build <> $1', [build])
        purged = true // la bandera, només si la purga ha anat bé
      }
      // Monotonia: un treball més antic no sobreescriu una fila més nova del mateix build;
      // una fila d'un altre build (un contenidor antic després de la purga) no compta.
      await getPool().query(
        `insert into next_cache (key, build, kind, payload, tags, revalidate, started_at, last_modified)
         select $1, $2, $3, $4, $5::text[], $6, to_timestamp($7 / 1000.0), now()
          where not exists (select 1 from next_cache_tags t
                             where (t.tag = any($5::text[]) or t.tag = $8) and t.invalidated_at > to_timestamp($7 / 1000.0))
         on conflict (key) do update set build = excluded.build, kind = excluded.kind, payload = excluded.payload,
            tags = excluded.tags, revalidate = excluded.revalidate, started_at = excluded.started_at, last_modified = now()
          where next_cache.build <> excluded.build or next_cache.started_at <= excluded.started_at`,
        [key, build, data.kind, encodeValue(data), tags, revalidate, startedAt, ALL_TAG],
      )
    } catch (error) {
      if (error.code !== '42P01') warn(`set failed: ${error.message}`)
    }
  }

  // Les durades (`{ expire }`) s'ignoren a propòsit: una sola semàntica (spec §26.4).
  async revalidateTag(tags) {
    const build = this.build()
    if (!build) return
    const list = uniq(Array.isArray(tags) ? tags : [tags])
    if (list.length === 0) return
    // La garantia: les làpides, en una sentència pròpia i amb les etiquetes ordenades.
    const upsert = `insert into next_cache_tags (tag, invalidated_at) select unnest($1::text[]), clock_timestamp()
                    on conflict (tag) do update set invalidated_at = greatest(next_cache_tags.invalidated_at, excluded.invalidated_at)`
    for (let attempt = 0; ; attempt++) {
      try {
        await getPool().query(upsert, [list])
        break
      } catch (error) {
        if (attempt === 0 && RETRYABLE.has(error.code)) continue
        // Error nou i sense `cause`: el registre de Next imprimeix l'objecte sencer.
        throw new Error(`[cache] invalidation failed: ${error.message}`)
      }
    }
    // La neteja: pot fallar sense conseqüències, les làpides ja garanteixen la correcció.
    try {
      if (list.includes(ALL_TAG)) await getPool().query('delete from next_cache')
      else await getPool().query('delete from next_cache where tags && $1::text[]', [list])
    } catch (error) {
      warn(`cleanup after invalidation failed: ${error.message}`)
    }
  }

  resetRequestCache() {}
}
