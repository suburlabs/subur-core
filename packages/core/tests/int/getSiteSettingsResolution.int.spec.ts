import config from '../fixtures/app/src/payload.config.js'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createSiteData } from '../../src/app/siteData.js'

// `unstable_cache` exigeix l'`incrementalCache` d'una petició real de Next.js: sota Vitest torna la funció tal qual (Task 8).
vi.mock('next/cache', () => ({ revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn }))

import { uiDefaults } from '../../src/i18n/uiDefaults.js'
import { resolveUi } from '../../src/i18n/resolveUi.js'

import { ensureSiteSettings } from '../helpers/ensureSiteSettings.js'

const context = { disableRevalidate: true }

/**
 * Aquesta prova cobreix les dues meitats de `getSiteSettings` per separat,
 * contra la base de dades real: la lectura sense *fallback* (el mateix
 * `findGlobal` que fa servir `getUiOverrides`) i la resolució (`resolveUi`).
 * Al paquet, a més, crida `createSiteData(config).getSiteSettings(locale)`
 * sencer, amb `unstable_cache` fingit (dalt).
 */
describe('resolución de site-settings de punta a punta', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>
  let originalEs: string | null | undefined
  let originalEn: string | null | undefined

  beforeAll(async () => {
    payload = await getPayload({ config })

    // Aquesta prova només verifica `ui.callUs`, però per escriure'l cal que els
    // camps obligatoris del global ja tinguin valor: vegeu l'ajudant.
    await ensureSiteSettings(payload)

    const es = await payload.findGlobal({
      depth: 0,
      fallbackLocale: false,
      locale: 'es',
      select: { ui: true },
      slug: 'site-settings',
    })
    originalEs = es.ui?.callUs

    const en = await payload.findGlobal({
      depth: 0,
      fallbackLocale: false,
      locale: 'en',
      select: { ui: true },
      slug: 'site-settings',
    })
    originalEn = en.ui?.callUs

    // `fallbackLocale: false` a totes quatre crides d'aquest fitxer: com fa
    // el panell (`?fallback-locale=null`), perquè una escriptura parcial per
    // idioma no arrossegui `location.areaServed` del castellà — la seva `id`
    // és clau primària compartida entre idiomes i una segona inserció hi
    // xocaria (Postgres 23505).
    await payload.updateGlobal({
      context,
      data: { ui: { callUs: 'Llame ahora mismo' } },
      fallbackLocale: false,
      locale: 'es',
      slug: 'site-settings',
    })
    await payload.updateGlobal({
      context,
      data: { ui: { callUs: '' } },
      fallbackLocale: false,
      locale: 'en',
      slug: 'site-settings',
    })
  })

  afterAll(async () => {
    // Restaura el valor RAW exacte capturat abans de la prova: si era `null`,
    // torna a quedar `null` (no `''`) — altrament aquesta prova deixaria la
    // base amb una sobreescriptura buida que abans no hi era.
    await payload.updateGlobal({
      context,
      data: { ui: { callUs: originalEs } },
      fallbackLocale: false,
      locale: 'es',
      slug: 'site-settings',
    })
    await payload.updateGlobal({
      context,
      data: { ui: { callUs: originalEn } },
      fallbackLocale: false,
      locale: 'en',
      slug: 'site-settings',
    })
  })

  it('la sobreescriptura del cliente en es se respeta, y el vacío en en cae al núcleo en inglés, no en español', async () => {
    const esRaw = await payload.findGlobal({
      depth: 0,
      fallbackLocale: false,
      locale: 'es',
      select: { ui: true },
      slug: 'site-settings',
    })
    const enRaw = await payload.findGlobal({
      depth: 0,
      fallbackLocale: false,
      locale: 'en',
      select: { ui: true },
      slug: 'site-settings',
    })

    const esResolved = resolveUi(esRaw.ui, 'es')
    const enResolved = resolveUi(enRaw.ui, 'en')

    expect(esResolved.callUs).toBe('Llame ahora mismo')
    expect(enResolved.callUs).toBe(uiDefaults.callUs.text.en)
    expect(enResolved.callUs).not.toBe('Llame ahora mismo')
    expect(enResolved.callUs).not.toBe(uiDefaults.callUs.text.es)

    // El mateix, de punta a punta per `createSiteData(config).getSiteSettings(locale)` (Task 8).
    const data = createSiteData(config)
    expect((await data.getSiteSettings('es')).ui.callUs).toBe('Llame ahora mismo')
    expect((await data.getSiteSettings('en')).ui.callUs).toBe(uiDefaults.callUs.text.en)
  })
})
