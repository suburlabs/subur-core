// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { CacheHandlerValue } from 'next/dist/server/lib/incremental-cache'
import type {
  CachedFetchValue,
  CachedRouteValue,
  IncrementalCachedAppPageValue,
} from 'next/dist/server/response-cache/types'
import pg from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import SuburCacheHandler, { ALL_TAG, endPool, resetModuleState } from '../../src/cache/handler.js'

/**
 * El handler de la memòria cau (spec §26.2, §26.4) contra la base de proves:
 * un `pg.Client` propi del test per preparar i comprovar les taules, i un
 * `serverDistDir` temporal amb `BUILD_ID` per a cada handler.
 */
let db: pg.Client
const tmpRoots: string[] = []

const dist = (build: string | null): string => {
  const root = mkdtempSync(path.join(tmpdir(), 'k2-cache-'))
  tmpRoots.push(root)
  mkdirSync(path.join(root, '.next', 'server'), { recursive: true })
  if (build !== null) writeFileSync(path.join(root, '.next', 'BUILD_ID'), build)
  return path.join(root, '.next', 'server')
}

const handler = (opts: Partial<{ dev: boolean; build: string | null }> = {}) =>
  new SuburCacheHandler({
    dev: opts.dev ?? false,
    serverDistDir: dist(opts.build === undefined ? 'testbuild' : opts.build),
    fs: undefined,
    flushToDisk: true,
    revalidatedTags: [],
    maxMemoryCacheSize: 0,
    _requestHeaders: {},
  } as never)

const page = (html: string, tags: string[], status = 200) => ({
  kind: 'APP_PAGE',
  html,
  rscData: Buffer.from('rsc'),
  headers: { 'x-next-cache-tags': tags.join(',') },
  postponed: undefined,
  status,
  segmentData: new Map([['/a', Buffer.from('seg')]]),
})
const route = (body: string) => ({ kind: 'APP_ROUTE', body: Buffer.from(body), status: 200, headers: { 'content-type': 'text/plain' } })
const fetchValue = (body: string) => ({ kind: 'FETCH', data: { headers: {}, body, url: '', status: 200 }, revalidate: 86400 })
const pageCtx = { cacheControl: { revalidate: 86400, expire: 604800 } }

const asPage = (got: CacheHandlerValue | null) => got?.value as IncrementalCachedAppPageValue | undefined
const asRoute = (got: CacheHandlerValue | null) => got?.value as CachedRouteValue | undefined
const asFetch = (got: CacheHandlerValue | null) => got?.value as CachedFetchValue | undefined

type Row = { key: string; build: string; kind: string; payload: string; tags: string[]; revalidate: number | null; last_modified_ms: string }
const rows = async (): Promise<Row[]> =>
  (
    await db.query<Row>(
      `select key, build, kind, payload, tags, revalidate,
              floor(extract(epoch from last_modified) * 1000)::text as last_modified_ms
         from next_cache order by key`,
    )
  ).rows
const count = async (): Promise<number> => (await rows()).length
const nowMs = async (): Promise<number> =>
  Number((await db.query<{ ms: string }>('select floor(extract(epoch from clock_timestamp()) * 1000)::text as ms')).rows[0].ms)
const tombstoneMs = async (tag: string): Promise<number | null> => {
  const { rows: r } = await db.query<{ ms: string }>(
    'select floor(extract(epoch from invalidated_at) * 1000)::text as ms from next_cache_tags where tag = $1',
    [tag],
  )
  return r[0] ? Number(r[0].ms) : null
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const spyWarn = (): string[] => {
  const lines: string[] = []
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '))
  })
  return lines
}

beforeAll(async () => {
  db = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
})

beforeEach(async () => {
  await db.query('truncate next_cache, next_cache_tags')
  resetModuleState()
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await endPool()
  await db.end()
  for (const root of tmpRoots) rmSync(root, { force: true, recursive: true })
})

describe('handler: anada i tornada', () => {
  it('APP_PAGE amb Buffer i Map, lastModified real', async () => {
    const h = handler()
    expect(await h.get('/es', { kind: 'APP_PAGE' })).toBeNull() // fixa startedAt['/es']
    await h.set('/es', page('<p>a</p>', ['_N_T_/layout', 'global_site-settings']), pageCtx)
    const got = await handler().get('/es', { kind: 'APP_PAGE' })
    expect(got?.value).toMatchObject({ kind: 'APP_PAGE', html: '<p>a</p>', status: 200 })
    expect(Buffer.isBuffer(asPage(got)?.rscData)).toBe(true)
    expect(asPage(got)?.rscData?.toString()).toBe('rsc')
    expect(asPage(got)?.segmentData).toBeInstanceOf(Map)
    expect(asPage(got)?.segmentData?.get('/a')?.toString()).toBe('seg')
    const [row] = await rows()
    expect(row).toMatchObject({ key: '/es', build: 'testbuild', kind: 'APP_PAGE', revalidate: 86400 })
    expect(row.tags).toEqual(['_N_T_/layout', 'global_site-settings'])
    const lm = Number(row.last_modified_ms)
    expect(got?.lastModified).toBe(lm) // mai falsejat
  })

  it('APP_ROUTE i FETCH', async () => {
    const h = handler()
    expect(await h.get('/feed.xml', { kind: 'APP_ROUTE' })).toBeNull()
    expect(await h.get('fetch-key', { kind: 'FETCH', tags: ['global_header'] })).toBeNull()
    await h.set('/feed.xml', route('<rss/>'), { cacheControl: { revalidate: false } })
    await h.set('fetch-key', fetchValue('{"ok":true}'), { tags: ['global_header'] })

    const gotRoute = await handler().get('/feed.xml', { kind: 'APP_ROUTE' })
    expect(Buffer.isBuffer(asRoute(gotRoute)?.body)).toBe(true)
    expect(asRoute(gotRoute)?.body.toString()).toBe('<rss/>')
    expect(asRoute(gotRoute)).toMatchObject({ kind: 'APP_ROUTE', status: 200, headers: { 'content-type': 'text/plain' } })

    const gotFetch = await handler().get('fetch-key', { kind: 'FETCH', tags: ['global_header'] })
    expect(asFetch(gotFetch)).toEqual(fetchValue('{"ok":true}'))

    const byKey = Object.fromEntries((await rows()).map((r) => [r.key, r]))
    expect(byKey['/feed.xml']).toMatchObject({ kind: 'APP_ROUTE', revalidate: null, tags: [] }) // `false` de Next → null
    expect(byKey['fetch-key']).toMatchObject({ kind: 'FETCH', revalidate: 86400, tags: ['global_header'] })
    expect(gotRoute?.lastModified).toBe(Number(byKey['/feed.xml'].last_modified_ms))
    expect(gotFetch?.lastModified).toBe(Number(byKey['fetch-key'].last_modified_ms))
  })

  it('set sense get previ de la clau no escriu', async () => {
    const h = handler()
    const lines = spyWarn()
    const query = vi.spyOn(pg.Pool.prototype, 'query')
    await h.set('/x', page('x', []), pageCtx)
    expect(query).toHaveBeenCalledTimes(0) // no hi va ni a provar-ho (i no és un error de la base)
    expect(lines).toEqual([])
    query.mockRestore()
    expect(await count()).toBe(0)
    // Un get d'una altra clau no dona cota per a aquesta.
    await h.get('/y', { kind: 'APP_PAGE' })
    await h.set('/x', page('x', []), pageCtx)
    expect(await count()).toBe(0)
  })

  it('no desa status >= 400 ni redireccions', async () => {
    const h = handler()
    for (const key of ['/404', '/307', '/redirect']) await h.get(key, { kind: 'APP_PAGE' })
    await h.set('/404', page('no hi és', [], 404), pageCtx)
    await h.set('/307', page('', [], 307), pageCtx)
    await h.set('/redirect', { kind: 'REDIRECT', props: {} }, pageCtx)
    expect(await count()).toBe(0)
    // Control: la mateixa instància sí que desa una 200.
    await h.get('/ok', { kind: 'APP_PAGE' })
    await h.set('/ok', page('ok', []), pageCtx)
    expect((await rows()).map((r) => r.key)).toEqual(['/ok'])
  })
})

describe('handler: build', () => {
  it('ignora i purga les files d’un altre build al primer set', async () => {
    const old = JSON.stringify(fetchValue('vell'))
    await db.query(
      `insert into next_cache (key, build, kind, payload, tags, revalidate, started_at, last_modified)
       values ('/es', 'old', 'FETCH', $1, '{}', 86400, now(), now()), ('/old', 'old', 'FETCH', $1, '{}', 86400, now(), now())`,
      [old],
    )
    const h = handler()
    expect(await h.get('/es', { kind: 'FETCH' })).toBeNull() // fila d'un altre build: miss
    expect(await count()).toBe(2) // el get no purga
    await h.set('/es', fetchValue('nou'), { tags: [] })
    const after = await rows()
    expect(after.map((r) => [r.key, r.build])).toEqual([['/es', 'testbuild']]) // '/old' purgada
    expect(JSON.parse(after[0].payload).data.body).toBe('nou')
  })
  it('una fila d’un altre build escrita després de la purga no bloqueja el set (la monotonia és per build)', async () => {
    const h = handler()
    await h.get('/ca', { kind: 'APP_PAGE' })
    await h.set('/ca', page('ca', []), pageCtx) // purga feta en aquest procés
    // Un contenidor antic escriu després de la purga, amb un started_at més nou que el del treball d'ara.
    await h.get('/es', { kind: 'APP_PAGE' })
    await db.query(
      `insert into next_cache (key, build, kind, payload, tags, revalidate, started_at, last_modified)
       values ('/es', 'old', 'FETCH', $1, '{}', 86400, clock_timestamp() + interval '1 hour', now())`,
      [JSON.stringify(fetchValue('vell'))],
    )
    await h.set('/es', page('nou', []), pageCtx)
    const es = (await rows()).find((r) => r.key === '/es')
    expect(es).toMatchObject({ build: 'testbuild', kind: 'APP_PAGE' })
    expect(asPage(await handler().get('/es', { kind: 'APP_PAGE' }))?.html).toBe('nou')
  })
})

describe('handler: làpides', () => {
  it('revalidateTag esborra pàgina i FETCH que porten l’etiqueta i deixa làpida', async () => {
    const h = handler()
    for (const key of ['/es', 'f1', '/ca']) await h.get(key, { kind: key.startsWith('/') ? 'APP_PAGE' : 'FETCH' })
    await h.set('/es', page('es', ['global_site-settings']), pageCtx)
    await h.set('f1', fetchValue('f1'), { tags: ['global_site-settings'] })
    await h.set('/ca', page('ca', ['pages_ca']), pageCtx)
    expect(await count()).toBe(3)

    const before = await nowMs()
    await handler().revalidateTag('global_site-settings', { expire: 0 })
    expect((await rows()).map((r) => r.key)).toEqual(['/ca']) // la que no la porta es queda
    expect(await tombstoneMs('global_site-settings')).toBeGreaterThanOrEqual(before)
    expect(await handler().get('/ca', { kind: 'APP_PAGE' })).not.toBeNull()
  })

  it('un get FETCH amb softTags que tenen làpida torna null', async () => {
    const h = handler()
    expect(await h.get('f', { kind: 'FETCH', tags: ['a'] })).toBeNull()
    await h.set('f', fetchValue('x'), { tags: ['a'] })
    await sleep(5)
    await handler().revalidateTag(['_N_T_/layout'])
    expect(await count()).toBe(1) // la neteja no la toca: la fila no porta l'etiqueta
    // Sense les softTags, la fila és vàlida…
    expect(await handler().get('f', { kind: 'FETCH', tags: ['a'] })).not.toBeNull()
    // …amb les de la pàgina que la llegeix, no, i s'esborra.
    expect(await handler().get('f', { kind: 'FETCH', tags: ['a'], softTags: ['_N_T_/layout'] })).toBeNull()
    expect(await count()).toBe(0)
  })

  it('un get que troba la fila morta només esborra la que ha llegit, no una de més nova escrita entremig', async () => {
    const h = handler()
    await h.get('f', { kind: 'FETCH', tags: ['a'] })
    await h.set('f', fetchValue('vella'), { tags: ['a'] })
    await sleep(2)
    await db.query(`insert into next_cache_tags (tag, invalidated_at) values ('a', clock_timestamp())`) // la vella és morta
    await sleep(2)
    // Entre el SELECT del get i el seu DELETE, un altre treball (començat després de la làpida) reescriu la fila.
    const original = pg.Pool.prototype.query
    vi.spyOn(pg.Pool.prototype, 'query').mockImplementationOnce(async function (this: pg.Pool, ...args: unknown[]) {
      const result = await (original as (...a: unknown[]) => Promise<unknown>).apply(this, args)
      await db.query(`update next_cache set started_at = clock_timestamp(), payload = $1 where key = 'f'`, [
        JSON.stringify(fetchValue('nova')),
      ])
      return result
    } as never)
    expect(await handler().get('f', { kind: 'FETCH', tags: ['a'] })).toBeNull() // ha jutjat la fila que ha llegit
    const after = await rows()
    expect(after).toHaveLength(1) // la nova es queda…
    expect(JSON.parse(after[0].payload).data.body).toBe('nova')
    expect(asFetch(await handler().get('f', { kind: 'FETCH', tags: ['a'] }))?.data.body).toBe('nova') // …i és vàlida
  })

  it('la làpida * atura tot', async () => {
    const h = handler()
    await h.get('/es', { kind: 'APP_PAGE' })
    await h.get('f', { kind: 'FETCH' })
    await h.set('/es', page('es', ['x']), pageCtx)
    await h.set('f', fetchValue('f'), { tags: [] })
    expect(await count()).toBe(2)

    await handler().revalidateTag(ALL_TAG, { expire: 0 })
    expect(await count()).toBe(0) // la neteja de '*' ho esborra tot
    expect(await tombstoneMs(ALL_TAG)).not.toBeNull()

    // Una fila que hagi sobreviscut a la neteja (escrita amb un started_at anterior) la descarta el get.
    await db.query(
      `insert into next_cache (key, build, kind, payload, tags, revalidate, started_at, last_modified)
       values ('/ca', 'testbuild', 'FETCH', $1, '{}', 86400, now() - interval '1 minute', now())`,
      [JSON.stringify(fetchValue('vell'))],
    )
    expect(await handler().get('/ca', { kind: 'FETCH' })).toBeNull()
    expect(await count()).toBe(0)

    // I un set d'un treball començat abans de '*' no escriu, encara que la fila no porti cap etiqueta.
    await h.set('/es', page('vell', []), pageCtx)
    expect(await count()).toBe(0)
  })

  it('cursa: A fa get (miss), invalidació, A escriu, B llegeix null', async () => {
    const a = handler()
    expect(await a.get('/es', { kind: 'APP_PAGE' })).toBeNull()
    await sleep(2)
    await handler().revalidateTag(['global_site-settings'], { expire: 0 })
    await a.set('/es', page('vell', ['global_site-settings']), pageCtx) // no escriu (NOT EXISTS) — i si escrivís…
    expect(await count()).toBe(0)
    expect(await handler().get('/es', { kind: 'APP_PAGE' })).toBeNull() // …el get el descartaria
  })

  it('dos get de la mateixa clau: started_at és el mínim', async () => {
    const h = handler()
    expect(await h.get('k', { kind: 'FETCH', tags: ['t'] })).toBeNull()
    const first = h.startedAt.get('k')
    await sleep(20)
    await handler().revalidateTag(['t'])
    expect(await h.get('k', { kind: 'FETCH', tags: ['t'] })).toBeNull()
    expect(h.startedAt.get('k')).toBe(first) // el segon get no l'avança
    await h.set('k', fetchValue('vell'), { tags: ['t'] })
    expect(await count()).toBe(0)
    expect(await handler().get('k', { kind: 'FETCH', tags: ['t'] })).toBeNull()
  })

  it('un set més antic no sobreescriu una fila més nova', async () => {
    const a = handler()
    const b = handler()
    await a.get('/es', { kind: 'APP_PAGE' })
    await sleep(5)
    await b.get('/es', { kind: 'APP_PAGE' })
    expect(b.startedAt.get('/es')).toBeGreaterThan(a.startedAt.get('/es') as number)
    await b.set('/es', page('de B', []), pageCtx)
    await a.set('/es', page('de A', []), pageCtx)
    const [row] = await rows()
    expect(JSON.parse(row.payload).html).toBe('de B')
    expect(asPage(await handler().get('/es', { kind: 'APP_PAGE' }))?.html).toBe('de B')
    // I un de més nou sí que la substitueix.
    const c = handler()
    await sleep(2)
    await c.get('/es', { kind: 'APP_PAGE' })
    await c.set('/es', page('de C', []), pageCtx)
    expect(JSON.parse((await rows())[0].payload).html).toBe('de C')
  })

  it('dues invalidacions concurrents amb etiquetes solapades no en perden cap', async () => {
    const before = await nowMs()
    await expect(
      Promise.all([handler().revalidateTag(['a', 'b']), handler().revalidateTag(['b', 'a'])]),
    ).resolves.toBeDefined() // cap de les dues rebutja (40P01 reintentat)
    for (const tag of ['a', 'b']) expect(await tombstoneMs(tag)).toBeGreaterThanOrEqual(before)
    // Una segona ronda només pot avançar les làpides (greatest).
    const first = await tombstoneMs('a')
    await Promise.all([handler().revalidateTag(['a', 'b', 'c']), handler().revalidateTag(['c', 'b'])])
    expect(await tombstoneMs('a')).toBeGreaterThanOrEqual(first as number)
    expect(await tombstoneMs('c')).not.toBeNull()
  })

  it('revalidateTag ordena les etiquetes i reintenta un cop en 40P01/40001; el segon error llança net', async () => {
    const retryable = (code: string) => Object.assign(new Error(`simulat ${code}`), { code })
    const query = vi.spyOn(pg.Pool.prototype, 'query')
    query.mockImplementationOnce(() => Promise.reject(retryable('40P01')))
    await handler().revalidateTag(['b', 'a', 'b'])
    expect(await tombstoneMs('a')).not.toBeNull()
    expect(await tombstoneMs('b')).not.toBeNull()
    // Primer intent fallit, reintent i neteja; les làpides, ordenades i sense repetides.
    expect(query).toHaveBeenCalledTimes(3)
    expect(query.mock.calls[0][1]).toEqual([['a', 'b']])
    expect(query.mock.calls[1][1]).toEqual([['a', 'b']])

    query.mockClear()
    query.mockImplementationOnce(() => Promise.reject(retryable('40001')))
    query.mockImplementationOnce(() => Promise.reject(retryable('40001')))
    const failure = await handler().revalidateTag(['c']).then(
      () => null,
      (error: unknown) => error,
    )
    expect((failure as Error).message).toBe('[cache] invalidation failed: simulat 40001')
    expect((failure as Error).cause).toBeUndefined()
    expect(query).toHaveBeenCalledTimes(2) // un sol reintent, i cap neteja si la làpida no s'ha desat
  })

  it('dos get concurrents de claus diferents en una instància nova fixen un started_at per clau', async () => {
    const h = handler()
    await Promise.all([h.get('/a', { kind: 'APP_PAGE' }), h.get('/b', { kind: 'APP_PAGE' })])
    expect(h.startedAt.size).toBe(2)
    expect([...h.startedAt.keys()].sort()).toEqual(['/a', '/b'])
    await Promise.all([h.set('/a', page('a', []), pageCtx), h.set('/b', page('b', []), pageCtx)])
    expect((await rows()).map((r) => r.key)).toEqual(['/a', '/b'])
  })

  it('un encert sense làpida fa una sola consulta', async () => {
    const h = handler()
    await h.get('/es', { kind: 'APP_PAGE' })
    await h.set('/es', page('es', ['global_site-settings']), pageCtx)
    const query = vi.spyOn(pg.Pool.prototype, 'query')
    const got = await handler().get('/es', { kind: 'APP_PAGE' })
    expect(asPage(got)?.html).toBe('es')
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('revalidateTag retorna la mateixa semàntica amb {expire:0}, sense durades i amb "max"', async () => {
    const durations: Array<{ expire?: number } | undefined> = [{ expire: 0 }, undefined, { expire: 31536000 }]
    for (const [i, d] of durations.entries()) {
      const key = `/p${i}`
      const tag = `t${i}`
      const h = handler()
      await h.get(key, { kind: 'APP_PAGE' })
      await h.set(key, page(key, [tag]), pageCtx)
      expect((await rows()).map((r) => r.key)).toEqual([key])
      const before = await nowMs()
      await handler().revalidateTag([tag], d)
      expect(await count()).toBe(0)
      expect(await tombstoneMs(tag)).toBeGreaterThanOrEqual(before)
      // La petició següent renderitza de nou: un set del treball antic tampoc no escriu.
      await h.set(key, page(key, [tag]), pageCtx)
      expect(await count()).toBe(0)
    }
  })
})

describe('handler: inert i errors', () => {
  const expectInert = async (make: () => SuburCacheHandler, line: string) => {
    const lines = spyWarn()
    const query = vi.spyOn(pg.Pool.prototype, 'query')
    for (const h of [make(), make()]) {
      expect(await h.get('/es', { kind: 'APP_PAGE' })).toBeNull()
      h.startedAt.set('/es', Date.now())
      await h.set('/es', page('x', ['a']), pageCtx)
      await h.revalidateTag(['a'], { expire: 0 })
    }
    expect(query).toHaveBeenCalledTimes(0)
    expect(lines.filter((l) => l === line)).toHaveLength(1)
    expect(lines.filter((l) => l.startsWith('[cache]'))).toEqual([line])
    expect(await count()).toBe(0)
    expect(await tombstoneMs('a')).toBeNull()
  }

  it("inert amb dev: get null, set i revalidateTag no toquen la base (vi.spyOn(pg.Pool.prototype, 'query') amb 0 crides), una sola línia `[cache] inert: dev`", async () => {
    await expectInert(() => handler({ dev: true }), '[cache] inert: dev')
  })

  it('inert amb NEXT_PHASE=phase-production-build (idem, amb la seva línia)', async () => {
    const saved = process.env.NEXT_PHASE
    process.env.NEXT_PHASE = 'phase-production-build'
    try {
      await expectInert(() => handler(), '[cache] inert: build')
    } finally {
      if (saved === undefined) delete process.env.NEXT_PHASE
      else process.env.NEXT_PHASE = saved
    }
  })

  it('inert sense BUILD_ID (idem, amb la seva línia; un segon handler no repeteix l’avís)', async () => {
    await expectInert(() => handler({ build: null }), '[cache] inert: no hi ha .next/BUILD_ID')
  })

  it('taules inexistents (42P01): get null i set silenciós, cap avís', async () => {
    const saved = process.env.DATABASE_URL as string
    await endPool()
    resetModuleState()
    const u = new URL(saved)
    u.searchParams.set('options', '-c search_path=k2_bare')
    process.env.DATABASE_URL = u.toString()
    const lines = spyWarn()
    const original = pg.Pool.prototype.query
    const codes: string[] = []
    vi.spyOn(pg.Pool.prototype, 'query').mockImplementation(function (this: pg.Pool, ...args: unknown[]) {
      return (original as (...a: unknown[]) => Promise<unknown>).apply(this, args).catch((error: { code?: string }) => {
        codes.push(String(error.code))
        throw error
      })
    } as never)
    try {
      const h = handler()
      expect(await h.get('/es', { kind: 'APP_PAGE' })).toBeNull()
      h.startedAt.set('/es', Date.now()) // força el set fins a la base
      await h.set('/es', page('x', []), pageCtx)
      expect(codes).toEqual(['42P01', '42P01']) // el get i el set (la purga) hi han anat i han trobat 42P01
      expect(lines.some((l) => l.startsWith('[cache] get failed') || l.startsWith('[cache] set failed'))).toBe(false)
      expect(lines.filter((l) => l.startsWith('[cache]'))).toEqual([])
    } finally {
      await endPool()
      process.env.DATABASE_URL = saved
      resetModuleState()
    }
    expect(await count()).toBe(0)
  })

  it('base inaccessible: get null, set silenci, i una línia per operació amb només el missatge', async () => {
    await endPool()
    const saved = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'postgres://u:secret@127.0.0.1:1/x'
    resetModuleState()
    const lines = spyWarn()
    try {
      const h = handler()
      expect(await h.get('/es', { kind: 'APP_PAGE' })).toBeNull()
      h.startedAt.set('/es', Date.now())
      await expect(h.set('/es', page('x', []), pageCtx)).resolves.toBeUndefined()
      expect(lines.some((l) => l.startsWith('[cache] get failed:'))).toBe(true)
      expect(lines.some((l) => l.startsWith('[cache] set failed:'))).toBe(true)
      expect(lines.filter((l) => l.startsWith('[cache] get failed:'))).toHaveLength(1)
      expect(lines.filter((l) => l.startsWith('[cache] set failed:'))).toHaveLength(1)
      expect(lines.join('\n')).not.toMatch(/secret|u:secret@/)
      const failure = await h.revalidateTag(['a']).then(
        () => null,
        (error: unknown) => error,
      )
      expect(failure).toBeInstanceOf(Error)
      expect((failure as Error).message).toMatch(/^\[cache\] invalidation failed:/)
      expect((failure as Error).cause).toBeUndefined() // error nou i net: res de pg penjat al darrere
      expect((failure as Error).message).not.toMatch(/secret|u:secret@/)
    } finally {
      await endPool()
      process.env.DATABASE_URL = saved
      resetModuleState()
    }
  })
})
