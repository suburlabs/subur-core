import { getPayload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn }))
vi.mock('subur-site-config', async () => {
  const { siteConfig } = await import('../fixtures/app/src/site/site.config.js')
  return { siteConfig: { ...siteConfig, defaultLocale: 'en' } }
})

import { createSiteData } from '../../src/app/siteData.js'
import { buildSuburConfig } from '../../src/config/index.js'
import { getRequestLocale } from '../../src/i18n/requestLocale.js'
import { siteConfig } from '../fixtures/app/src/site/site.config.js'

describe('per defecte en (cap es fix al graf de render)', () => {
  it('getActiveLocales posa en primer; requestLocale torna en sense petició', async () => {
    const config = buildSuburConfig({ ...siteConfig, defaultLocale: 'en' }, { baseDir: '/tmp' })
    await (await getPayload({ config })).updateGlobal({ data: { activeLocales: ['es', 'en'], maxLanguages: 3 }, slug: 'subscription' })
    expect(await createSiteData(config).getActiveLocales()).toEqual(['en', 'es'])
    expect(getRequestLocale()).toBe('en')
  })
})
