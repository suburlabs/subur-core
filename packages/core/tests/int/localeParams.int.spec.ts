import { describe, expect, it } from 'vitest'

import { sortActiveLocales } from '../../src/i18n/activeLocalesOrder.js'
import * as config from '../../src/i18n/config.js'
import { getLocaleRedirect } from '../../src/i18n/localeRedirect.js'
import { pageHref } from '../../src/i18n/paths.js'
import { validateActiveLocales } from '../../src/Subscription/validateActiveLocales.js'
import { buildAlternates } from '../../src/utilities/alternates.js'
import { generatePreviewPath } from '../../src/utilities/generatePreviewPath.js'

const req = (locale?: string) => ({ locale }) as unknown as Parameters<typeof generatePreviewPath>[0]['req']

describe('utilitats dels dos grafs: defaultLocale és un argument (spec §3.2.3)', () => {
  it('i18n/config ja no exporta defaultLocale', () => {
    expect('defaultLocale' in config).toBe(false)
  })
  it('getLocaleRedirect: un prefix semblant a idioma va al per defecte rebut', () => {
    expect(getLocaleRedirect({ defaultLocale: 'ca', pathname: '/fr/x' })).toBe('/ca/x')
    expect(getLocaleRedirect({ defaultLocale: 'en', pathname: '/fr/x' })).toBe('/en/x')
    expect(getLocaleRedirect({ acceptLanguage: 'de', defaultLocale: 'ca', pathname: '/' })).toBe('/ca')
  })
  it('sortActiveLocales: el per defecte rebut, primer i sempre', () => {
    expect(sortActiveLocales(['en'], 'ca')).toEqual(['ca', 'en'])
    expect(sortActiveLocales(['ca', 'es'], 'en')).toEqual(['en', 'es', 'ca'])
  })
  it('buildAlternates: x-default al per defecte rebut', () => {
    expect(buildAlternates('en', 'home', ['ca', 'en'], 'ca').languages['x-default']).toBe(pageHref('ca', 'home'))
  })
  it('generatePreviewPath: sense idioma a la petició, el per defecte rebut', () => {
    expect(generatePreviewPath({ defaultLocale: 'ca', req: req(), slug: 'x' })).toContain(encodeURIComponent(pageHref('ca', 'x')))
  })
  it('validateActiveLocales: exigeix el per defecte rebut i conserva el límit del contracte', () => {
    expect(validateActiveLocales('ca')(['es'])).toMatch(/\(ca\)/)
    expect(validateActiveLocales('ca')(['ca', 'es'])).toBe(true)
    expect(validateActiveLocales('ca')(['ca', 'es', 'en'], 2)).toMatch(/2/)
  })
})
