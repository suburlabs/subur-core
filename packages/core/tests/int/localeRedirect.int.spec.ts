import { describe, expect, it } from 'vitest'

import { getLocaleRedirect } from '../../src/i18n/localeRedirect.js'

describe('getLocaleRedirect', () => {
  it('does nothing for localized paths', () => {
    expect(getLocaleRedirect({ pathname: '/ca/serveis', defaultLocale: 'es' })).toBeNull()
    expect(getLocaleRedirect({ pathname: '/es', defaultLocale: 'es' })).toBeNull()
  })

  it('prefixes the root with the resolved locale', () => {
    expect(getLocaleRedirect({ pathname: '/', acceptLanguage: 'ca-ES,ca;q=0.9', defaultLocale: 'es' })).toBe('/ca')
    expect(getLocaleRedirect({ pathname: '/', cookieLocale: 'en', defaultLocale: 'es' })).toBe('/en')
    expect(getLocaleRedirect({ pathname: '/', defaultLocale: 'es' })).toBe('/es')
  })

  it('prefixes unlocalized paths and keeps the query', () => {
    expect(getLocaleRedirect({ pathname: '/contacte', search: '?a=1', defaultLocale: 'es' })).toBe(
      '/es/contacte?a=1',
    )
  })

  it('sends unsupported locale prefixes to the default locale', () => {
    expect(getLocaleRedirect({ pathname: '/fr/serveis', cookieLocale: 'ca', defaultLocale: 'es' })).toBe('/es/serveis')
    expect(getLocaleRedirect({ pathname: '/de', defaultLocale: 'es' })).toBe('/es')
  })
})
