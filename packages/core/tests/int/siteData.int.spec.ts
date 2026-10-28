import { getPayload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const cached = vi.hoisted(() => [] as Array<{ keys: unknown; opts: { tags?: string[] } }>)
vi.mock('next/cache', () => ({
  revalidateTag: () => {},
  unstable_cache: (fn: unknown, keys: unknown, opts: { tags?: string[] }) => (cached.push({ keys, opts }), fn),
}))

import { createSiteData } from '../../src/app/siteData.js'
import config from '../fixtures/app/src/payload.config.js'

describe('createSiteData(config): la configuració arriba per argument (spec §3.2.1)', () => {
  beforeAll(async () => {
    const payload = await getPayload({ config })
    await payload.updateGlobal({ data: { activeLocales: ['en', 'es'], maxLanguages: 3 }, slug: 'subscription' })
  })
  it('ordena els idiomes actius amb el per defecte del client primer (es), no amb l\'ordre desat', async () => {
    expect(await createSiteData(config).getActiveLocales()).toEqual(['es', 'en'])
  })
  it('les claus, les etiquetes i el termini de cau són els d\'avui (el handler i la porta en depenen)', async () => {
    cached.length = 0
    const data = createSiteData(config)
    // Es criden abans d'afirmar: una implementació que creï les entrades de cau en cridar (no en crear) també ha de passar.
    await data.getActiveLocales(); await data.getModules(); await data.getSiteSettings('es')
    await data.getCachedGlobal('header', 'es', 1)(); await data.getCachedRedirects()(); await data.getFooterCredit()
    expect(cached.map((c) => c.keys)).toEqual(expect.arrayContaining([['active-locales'], ['subscription-modules'], ['subscription-footer-credit'], ['site-settings-ui', 'es'], ['site-settings', 'es', '0'], ['header', 'es', '1'], ['redirects']]))
    for (const c of cached) expect((c.opts as { revalidate?: number }).revalidate, JSON.stringify(c.keys)).toBe(86400)
    expect(cached.find((c) => JSON.stringify(c.keys) === '["header","es","1"]')!.opts.tags).toEqual(['global_header'])
    expect(cached.find((c) => JSON.stringify(c.keys) === '["redirects"]')!.opts.tags).toEqual(['redirects'])
    expect(cached.find((c) => JSON.stringify(c.keys) === '["active-locales"]')!.opts.tags).toEqual(['global_subscription'])
    expect(cached.find((c) => JSON.stringify(c.keys) === '["subscription-modules"]')!.opts.tags).toEqual(['global_subscription'])
    expect(cached.find((c) => JSON.stringify(c.keys) === '["subscription-footer-credit"]')?.opts.tags).toEqual(['global_subscription'])
  })
  it('getFooterCredit llegeix subscription.footerCredit: només un true encén el crèdit (spec §0.5)', async () => {
    // El mock d'unstable_cache torna la funció tal qual: cada crida llegeix el global desat.
    const payload = await getPayload({ config })
    await payload.updateGlobal({ data: { footerCredit: false }, slug: 'subscription' })
    expect(await createSiteData(config).getFooterCredit()).toBe(false)
    await payload.updateGlobal({ data: { footerCredit: true }, slug: 'subscription' })
    expect(await createSiteData(config).getFooterCredit()).toBe(true)
    await payload.updateGlobal({ data: { footerCredit: null as never }, slug: 'subscription' })
    expect(await createSiteData(config).getFooterCredit()).toBe(false)
  })
})
