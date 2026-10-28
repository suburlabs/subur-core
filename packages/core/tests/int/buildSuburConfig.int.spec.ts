import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { buildSuburConfig, seoGenerators } from '../../src/config/index.js'
import { pageHref } from '../../src/i18n/paths.js'
import { getServerSideURL } from '../../src/utilities/getURL.js'
import { siteConfig } from '../fixtures/app/src/site/site.config.js'

const baseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/app/src')

/** Totes les cadenes de l'objecte, amb el camí on són (la configuració resolta té cicles). */
const stringsOf = (root: unknown): Array<[string, string]> => {
  const seen = new WeakSet<object>()
  const out: Array<[string, string]> = []
  const visit = (value: unknown, at: string) => {
    if (typeof value === 'string') out.push([at, value])
    else if (value && typeof value === 'object' && !seen.has(value)) {
      seen.add(value)
      for (const [key, child] of Object.entries(value)) visit(child, `${at}.${key}`)
    }
  }
  visit(root, '')
  return out
}

describe('buildSuburConfig (graf de configuració, spec §3.2.1)', () => {
  it('l\'idioma per defecte i el de reserva del panell surten de l\'argument', async () => {
    const ca = await buildSuburConfig({ ...siteConfig, defaultLocale: 'ca' }, { baseDir })
    const en = await buildSuburConfig({ ...siteConfig, defaultLocale: 'en' }, { baseDir })
    expect(ca.localization && ca.localization.defaultLocale).toBe('ca')
    expect(en.localization && en.localization.defaultLocale).toBe('en')
    expect(ca.i18n.fallbackLanguage).toBe('ca')
  })
  it('components d\'admin per cadena del paquet (importMap)', async () => {
    const config = await buildSuburConfig(siteConfig, { baseDir })
    expect(config.admin.components?.graphics).toEqual({ Icon: '@suburlabs/core/admin#AdminIcon', Logo: '@suburlabs/core/admin#AdminLogo' })
    expect(JSON.stringify(config.admin.components?.beforeDashboard)).toContain('@suburlabs/core/admin#BeforeDashboard')
    expect(config.admin.importMap.importMapFile).toBe(path.resolve(baseDir, 'app/(subur)/admin/importMap.js'))
  })
  it('cap camí de component amb l\'àlies @/ (revisió PR-A): els RowLabel de capçalera i peu surten del paquet', async () => {
    const strings = stringsOf(await buildSuburConfig(siteConfig, { baseDir }))
    expect(strings.filter(([, s]) => s.startsWith('@/'))).toEqual([])
    const rowLabels = strings.filter(([at]) => at.endsWith('.components.RowLabel')).map(([, s]) => s)
    expect(rowLabels.sort()).toEqual(['@suburlabs/core/admin#FooterRowLabel', '@suburlabs/core/admin#FooterRowLabel', '@suburlabs/core/admin#HeaderRowLabel'])
  })
  it('correu de suport: hola@subur.dev per defecte, configurable', async () => {
    const def = await buildSuburConfig(siteConfig, { baseDir })
    const own = await buildSuburConfig(siteConfig, { baseDir, support: { email: 'ajuda@demo.example' } })
    expect(JSON.stringify(def.admin.components?.beforeDashboard)).toContain('hola@subur.dev')
    expect(JSON.stringify(own.admin.components?.beforeDashboard)).toContain('ajuda@demo.example')
  })
  it('el missatge d\'idioma no inclòs del panell porta el correu de suport de l\'argument, no un de fix', async () => {
    const def = await buildSuburConfig(siteConfig, { baseDir })
    const own = await buildSuburConfig(siteConfig, { baseDir, support: { email: 'ajuda@demo.example' } })
    const inactive = (config: typeof def) => (['ca', 'en', 'es'] as const).map((code) => (config.i18n.translations as Record<string, { subur: { localeInactive: string } }>)[code].subur.localeInactive)
    for (const text of inactive(def)) expect(text).toMatch(/hola@subur\.dev$/)
    for (const text of inactive(own)) expect(text).toMatch(/ajuda@demo\.example$/)
  })
  it('tipus no autogenerats; cookiePrefix i titleSuffix fixos (spec §0.5)', async () => {
    const config = await buildSuburConfig(siteConfig, { baseDir })
    expect(config.typescript.autoGenerate).toBe(false)
    expect(config.cookiePrefix).toBe('subur')
    expect(config.admin.meta?.titleSuffix).toBe('— Subur')
  })
  it('el global subscription: per defecte i validació amb l\'idioma de l\'argument', async () => {
    const config = await buildSuburConfig({ ...siteConfig, defaultLocale: 'ca' }, { baseDir })
    const field = config.globals.find((g) => g.slug === 'subscription')!.fields.find((f) => 'name' in f && f.name === 'activeLocales') as { defaultValue?: unknown }
    expect(field.defaultValue).toEqual(['ca'])
  })
  it('el títol i l\'URL SEO llegeixen l\'argument (C34, C47, C54, C64)', () => {
    const seo = seoGenerators({ ...siteConfig, defaultLocale: 'ca', name: 'Una Altra' })
    expect(seo.generateTitle({ doc: { title: 'Inici' } } as never)).toBe('Inici | Una Altra')
    expect(seo.generateTitle({ doc: {} } as never)).toBe('Una Altra')
    expect(seo.generateURL({ doc: { slug: 'serveis' } } as never)).toBe(`${getServerSideURL()}${pageHref('ca', 'serveis')}`)
    expect(seo.generateURL({ doc: { slug: 'home' }, locale: 'en' } as never)).toBe(`${getServerSideURL()}${pageHref('en', 'home')}`)
  })
  it('plugins(siteConfig) connecta seoGenerators a l\'endpoint SEO del motor (residu de C34; sonda S20)', async () => {
    const config = await buildSuburConfig({ ...siteConfig, name: 'Una Altra' }, { baseDir })
    const endpoint = config.endpoints.find((e) => e.path === '/plugin-seo/generate-title' && e.method === 'post')!
    const res = await endpoint.handler({ json: async () => ({ collectionSlug: 'pages', doc: { title: 'Inici' } }) } as never)
    expect(await res.json()).toEqual({ result: 'Inici | Una Altra' })
  })
})
