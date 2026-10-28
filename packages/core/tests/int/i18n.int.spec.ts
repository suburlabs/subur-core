import { describe, expect, it } from 'vitest'

import { isLocale, locales } from '../../src/i18n/config.js'
import { pageHref, switchLocalePath } from '../../src/i18n/paths.js'
import { resolveLocale } from '../../src/i18n/resolveLocale.js'
import { defaultLocaleOf } from '../../src/site/index.js'
import { siteConfig as fixtureSiteConfig } from '../fixtures/app/src/site/site.config.js'

// Al paquet, l'idioma per defecte és del client (Task 5): el del client de prova.
const defaultLocale = defaultLocaleOf(fixtureSiteConfig)

const options = { locales: ['es', 'ca', 'en'] as const, defaultLocale: 'es' as const }

describe('i18n config', () => {
  it('takes the locale list from the core catalogue, not from the site', async () => {
    const { catalogLocales } = await import('../../src/i18n/catalog.js')
    const { siteConfig } = await import('../fixtures/app/src/site/site.config.js')

    expect(locales).toEqual([...catalogLocales])
    expect(catalogLocales).toContain(defaultLocale)
    expect('locales' in siteConfig).toBe(false)
  })

  it('recognises catalogue locales and rejects anything else', () => {
    expect(isLocale('ca')).toBe(true)
    expect(isLocale('es')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale('')).toBe(false)
  })
})

describe('resolveLocale', () => {
  it('prefers a valid cookie', () => {
    expect(resolveLocale({ cookie: 'en', acceptLanguage: 'ca-ES,ca;q=0.9' }, options)).toBe('en')
  })

  it('ignores an invalid cookie and uses Accept-Language', () => {
    expect(resolveLocale({ cookie: 'fr', acceptLanguage: 'ca-ES,ca;q=0.9' }, options)).toBe('ca')
  })

  it('respects q-values', () => {
    expect(resolveLocale({ acceptLanguage: 'fr;q=1, en;q=0.8, ca;q=0.9' }, options)).toBe('ca')
  })

  it('falls back to the default for unsupported languages', () => {
    expect(resolveLocale({ acceptLanguage: 'fr-FR' }, options)).toBe('es')
  })

  it('falls back to the default without headers', () => {
    expect(resolveLocale({}, options)).toBe('es')
  })
})

describe('paths', () => {
  it('builds page hrefs', () => {
    expect(pageHref('es', 'home')).toBe('/es')
    expect(pageHref('ca', 'serveis')).toBe('/ca/serveis')
  })

  it('switches the locale segment and keeps the rest', () => {
    const known = ['es', 'ca', 'en']
    expect(switchLocalePath('/es/contacte', 'ca', known)).toBe('/ca/contacte')
    expect(switchLocalePath('/es', 'en', known)).toBe('/en')
    expect(switchLocalePath('/es/contacto?x=1#form', 'en', known)).toBe('/en/contacto?x=1#form')
    expect(switchLocalePath('/serveis', 'ca', known)).toBe('/ca/serveis')
  })
})
