// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import config from '../fixtures/app/src/payload.config.js'
import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import SuburCacheHandler, { ALL_TAG, endPool, resetModuleState } from '../../src/cache/handler.js'

const revalidateTag = vi.hoisted(() => vi.fn())
vi.mock('next/cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/cache')>()),
  revalidateTag,
}))

const {
  CACHE_ALL_TAG,
  invalidateAfterChange,
  invalidateAfterDelete,
  invalidateGlobalAfterChange,
  invalidateSiteCache,
  shouldInvalidate,
} = await import('../../src/hooks/invalidateSiteCache.js')
/**
 * La configuració del client de prova arriba per `@suburlabs/core/config`, és a dir, de `dist/`: el cablejat es mira
 * contra les funcions d'aquell mòdul (les de `src/` són unes altres instàncies i `toContain` mai les hi trobaria).
 */
const wired = await import('../../dist/hooks/invalidateSiteCache.js')

/**
 * El hook únic d'invalidació (spec §26.4): dins d'una petició HTTP invalida
 * amb `revalidateTag('*')`; fora (`local`: tasques, scripts) escriu la làpida
 * `'*'` amb 60 s de marge per la connexió del CMS. Mai llança.
 */
let payload: Payload
const tmpRoots: string[] = []

const tombstones = async () =>
  (
    await payload.db.drizzle.execute(
      sql`select tag, invalidated_at > clock_timestamp() + interval '50 seconds' as with_margin from next_cache_tags where tag = '*'`,
    )
  ).rows as { tag: string; with_margin: boolean }[]

const httpReq = (payloadAPI: 'REST' | 'GraphQL', context: Record<string, unknown> = {}) =>
  ({ context, payload, payloadAPI }) as unknown as PayloadRequest

const dist = (build: string): string => {
  const root = mkdtempSync(path.join(tmpdir(), 'k2-invalidate-'))
  tmpRoots.push(root)
  mkdirSync(path.join(root, '.next', 'server'), { recursive: true })
  writeFileSync(path.join(root, '.next', 'BUILD_ID'), build)
  return path.join(root, '.next', 'server')
}

const cacheHandler = () =>
  new SuburCacheHandler({
    dev: false,
    serverDistDir: dist('testbuild'),
    fs: undefined,
    flushToDisk: true,
    revalidatedTags: [],
    maxMemoryCacheSize: 0,
    _requestHeaders: {},
  } as never)

beforeAll(async () => {
  payload = await getPayload({ config })
})

beforeEach(async () => {
  revalidateTag.mockReset()
  await payload.db.drizzle.execute(sql`truncate next_cache, next_cache_tags`)
  resetModuleState()
})

afterAll(async () => {
  await payload.db.drizzle.execute(sql`truncate next_cache, next_cache_tags`)
  await endPool()
  for (const root of tmpRoots) rmSync(root, { force: true, recursive: true })
})

describe('shouldInvalidate', () => {
  it('amb esborranys: publicar → sí; despublicar → sí; esborrany→esborrany → no; crear un esborrany (previousDoc {}) → no', () => {
    expect(shouldInvalidate(true, { _status: 'published' }, { _status: 'draft' })).toBe(true)
    expect(shouldInvalidate(true, { _status: 'draft' }, { _status: 'published' })).toBe(true)
    expect(shouldInvalidate(true, { _status: 'draft' }, { _status: 'draft' })).toBe(false)
    expect(shouldInvalidate(true, { _status: 'draft' }, {})).toBe(false)
    expect(shouldInvalidate(false, {}, {})).toBe(true) // sense esborranys (media, forms, redirects, globals): sempre
  })

  it('CACHE_ALL_TAG és la mateixa cadena que ALL_TAG del handler', () => {
    expect(CACHE_ALL_TAG).toBe(ALL_TAG)
  })
})

describe('invalidateSiteCache', () => {
  it('amb req.payloadAPI REST crida revalidateTag("*", { expire: 0 }) i respecta disableRevalidate', async () => {
    await invalidateSiteCache(httpReq('REST'), 'test')
    expect(revalidateTag).toHaveBeenCalledTimes(1)
    expect(revalidateTag).toHaveBeenCalledWith('*', { expire: 0 })
    expect(await tombstones()).toEqual([]) // la làpida l'escriu el handler a `waitUntil`, no el hook

    revalidateTag.mockClear()
    await invalidateSiteCache(httpReq('GraphQL'), 'test')
    expect(revalidateTag).toHaveBeenCalledWith('*', { expire: 0 })

    revalidateTag.mockClear()
    await invalidateSiteCache(httpReq('REST', { disableRevalidate: true }), 'test')
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(await tombstones()).toEqual([])
  })

  it('amb req.payloadAPI REST i revalidateTag que llança, escriu la làpida * amb marge i no llança', async () => {
    revalidateTag.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing in revalidateTag *')
    })
    await expect(invalidateSiteCache(httpReq('REST'), 'test')).resolves.toBeUndefined()
    expect(revalidateTag).toHaveBeenCalledTimes(1)
    expect(await tombstones()).toEqual([{ tag: '*', with_margin: true }])
  })

  it('amb req.payloadAPI local i un revalidateTag que NO llança, escriu la làpida * amb 60 s de marge (el cas real de les tasques)', async () => {
    revalidateTag.mockImplementation(() => undefined) // el `workStore` heretat d'una petició acabada: no llança, no fa res
    const req = await createLocalReq({}, payload)
    expect(req.payloadAPI).toBe('local')
    await invalidateSiteCache(req, 'test')
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(await tombstones()).toEqual([{ tag: '*', with_margin: true }])
  })

  it('fora de petició, un render començat DESPRÉS del hook i abans de la confirmació no queda vàlid (prova el marge)', async () => {
    const render = async (key: string) => {
      const a = cacheHandler()
      expect(await a.get(key, { kind: 'APP_PAGE' } as never)).toBeNull() // el render comença ara
      await a.set(
        key,
        {
          kind: 'APP_PAGE',
          html: '<p>contingut antic</p>',
          rscData: Buffer.from('rsc'),
          headers: { 'x-next-cache-tags': '_N_T_/layout' },
          postponed: undefined,
          status: 200,
          segmentData: new Map(),
        } as never,
        { cacheControl: { revalidate: 86400, expire: 604800 } } as never,
      )
      return cacheHandler().get(key, { kind: 'APP_PAGE' } as never)
    }
    // Control positiu: sense hook, el mateix render queda desat i un altre handler el llegeix.
    expect(await render('/ca')).not.toBeNull()

    await invalidateSiteCache(await createLocalReq({}, payload), 'test')
    expect(await render('/es')).toBeNull() // començat després del hook, dins del marge
  })

  it('tombstoneAll que falla (db.execute rebutja, p. ex. 42P01): el hook no llança i escriu una línia [cache] invalidation failed', async () => {
    const error = vi.fn()
    const failing = Object.assign(new Error('relation "next_cache_tags" does not exist'), { code: '42P01' })
    const req = {
      context: {},
      payload: { db: { drizzle: { execute: vi.fn().mockRejectedValue(failing) } }, logger: { error, info: vi.fn() } },
      payloadAPI: 'local',
    } as unknown as PayloadRequest
    await expect(invalidateSiteCache(req, 'test')).resolves.toBeUndefined()
    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith('[cache] invalidation failed: relation "next_cache_tags" does not exist')
  })
})

describe('hooks', () => {
  it('afterChange omet els desats d’esborrany a esborrany; afterDelete i els globals invaliden sempre', async () => {
    const pages = payload.collections.pages.config
    const doc = { id: 1, _status: 'draft' }
    await invalidateAfterChange({ collection: pages, doc, previousDoc: { _status: 'draft' }, req: httpReq('REST') } as never)
    await invalidateAfterChange({ collection: pages, doc, previousDoc: {}, req: httpReq('REST') } as never)
    expect(revalidateTag).not.toHaveBeenCalled()

    await invalidateAfterChange({ collection: pages, doc, previousDoc: { _status: 'published' }, req: httpReq('REST') } as never)
    expect(revalidateTag).toHaveBeenCalledTimes(1)

    const media = payload.collections.media.config
    await invalidateAfterChange({ collection: media, doc: { id: 2 }, previousDoc: {}, req: httpReq('REST') } as never)
    expect(revalidateTag).toHaveBeenCalledTimes(2)

    await invalidateAfterDelete({ collection: pages, doc, id: 1, req: httpReq('REST') } as never)
    expect(revalidateTag).toHaveBeenCalledTimes(3)

    const header = payload.globals.config.find((g) => g.slug === 'header')!
    await invalidateGlobalAfterChange({ doc: {}, global: header, previousDoc: {}, req: httpReq('REST') } as never)
    expect(revalidateTag).toHaveBeenCalledTimes(4)
    for (const call of revalidateTag.mock.calls) expect(call).toEqual(['*', { expire: 0 }])
  })

  it('cada col·lecció i global de l’abast porta el hook', () => {
    for (const slug of ['pages', 'media', 'forms', 'redirects'] as const) {
      expect(payload.collections[slug].config.hooks.afterChange, slug).toContain(wired.invalidateAfterChange)
      expect(payload.collections[slug].config.hooks.afterDelete, slug).toContain(wired.invalidateAfterDelete)
    }
    for (const slug of ['site-settings', 'header', 'footer', 'subscription']) {
      expect(payload.globals.config.find((g) => g.slug === slug)!.hooks.afterChange, slug).toContain(
        wired.invalidateGlobalAfterChange,
      )
    }
  })

  it('form-submissions i les col·leccions internes no porten el hook', () => {
    for (const [slug, collection] of Object.entries(payload.collections)) {
      if (['pages', 'media', 'forms', 'redirects'].includes(slug)) continue
      expect(collection.config.hooks.afterChange ?? [], slug).not.toContain(wired.invalidateAfterChange)
      expect(collection.config.hooks.afterDelete ?? [], slug).not.toContain(wired.invalidateAfterDelete)
    }
  })

  it('una pàgina pel CMS (local): esborrany i esborrany→esborrany no deixen làpida; publicar, despublicar i esborrar sí, amb marge', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { layout: [{ blockType: 'statement', text: 'K2', variant: 'default' }], slug: 'k2-invalidate', title: 'K2' },
      draft: true,
      locale: 'es',
    })
    try {
      expect(await tombstones()).toEqual([])
      await payload.update({ collection: 'pages', data: { title: 'K2 bis' }, draft: true, id: page.id, locale: 'es' })
      expect(await tombstones()).toEqual([])

      await payload.update({ collection: 'pages', data: { _status: 'published' }, id: page.id, locale: 'es' })
      expect(await tombstones()).toEqual([{ tag: '*', with_margin: true }])

      await payload.db.drizzle.execute(sql`truncate next_cache_tags`)
      await payload.update({ collection: 'pages', data: { _status: 'draft' }, id: page.id, locale: 'es' })
      expect(await tombstones()).toEqual([{ tag: '*', with_margin: true }])

      await payload.db.drizzle.execute(sql`truncate next_cache_tags`)
    } finally {
      await payload.delete({ collection: 'pages', id: page.id })
    }
    expect(await tombstones()).toEqual([{ tag: '*', with_margin: true }])
  })

  it('una redirecció pel CMS (local, sense esborranys): crear i esborrar deixen làpida', async () => {
    const redirect = await payload.create({
      collection: 'redirects',
      data: { from: '/k2-invalidate', to: { type: 'custom', url: '/es' } },
    })
    expect(await tombstones()).toEqual([{ tag: '*', with_margin: true }])
    await payload.db.drizzle.execute(sql`truncate next_cache_tags`)
    await payload.delete({ collection: 'redirects', id: redirect.id })
    expect(await tombstones()).toEqual([{ tag: '*', with_margin: true }])
  })

  it('una publicació programada corre a la cua default (la que buida l’autoRun cada minut), publica la pàgina i deixa la làpida amb marge (spec §26.8, risc 6)', async () => {
    expect(payload.config.jobs.autoRun).toContainEqual({ cron: '* * * * *', queue: 'default' })
    const page = await payload.create({
      collection: 'pages',
      data: { layout: [{ blockType: 'statement', text: 'K2', variant: 'default' }], slug: 'k2-scheduled', title: 'K2' },
      draft: true,
      locale: 'es',
    })
    try {
      await payload.db.drizzle.execute(sql`truncate next_cache_tags`)
      // El mateix encuament que el botó «Programar» (`schedulePublishHandler`: sense `queue`), ja vençut.
      const job = await payload.jobs.queue({
        input: { doc: { relationTo: 'pages', value: page.id }, type: 'publish' },
        task: 'schedulePublish',
        waitUntil: new Date(Date.now() - 1000),
      })
      const stored = await payload.findByID({ collection: 'payload-jobs', id: job.id })
      expect(stored.queue).toBe('default')

      // La mateixa crida que fa el cron de l'`autoRun` (`jobs.run({ queue })`).
      const result = await payload.jobs.run({ queue: 'default' })
      expect(result.jobStatus?.[String(job.id)]?.status).toBe('success')
      expect((await payload.findByID({ collection: 'pages', depth: 0, id: page.id }))._status).toBe('published')
      expect(await tombstones()).toEqual([{ tag: '*', with_margin: true }])
    } finally {
      await payload.delete({ collection: 'pages', id: page.id })
    }
  })

  it('un enviament de formulari (form-submissions) no invalida res', async () => {
    const form = await payload.create({
      collection: 'forms',
      data: {
        confirmationType: 'redirect',
        fields: [{ blockType: 'text', label: 'Nom', name: 'nom' }],
        redirect: { type: 'custom', url: '/es' },
        title: 'K2',
      },
      locale: 'es',
    })
    try {
      await payload.db.drizzle.execute(sql`truncate next_cache_tags`)
      await payload.create({ collection: 'form-submissions', data: { form: form.id, submissionData: [{ field: 'nom', value: 'x' }] } })
      expect(await tombstones()).toEqual([])
    } finally {
      await payload.delete({ collection: 'form-submissions', where: { form: { equals: form.id } } })
      await payload.delete({ collection: 'forms', id: form.id })
    }
  })
})
