import { describe, expect, it } from 'vitest'
import { defaultLocaleOf, defineSiteConfig, locales, seedOrderOf, supportedLocales } from '../../src/site/index.js'

describe('./site', () => {
  it('el catàleg i el seu ordre', () => {
    expect(locales).toEqual(['es', 'ca', 'en'])
    expect(Object.keys(supportedLocales).sort()).toEqual(['ca', 'en', 'es'])
  })
  it('defaultLocaleOf llegeix l\'argument, mai un estat global', () => {
    expect(defaultLocaleOf({ defaultLocale: 'ca' })).toBe('ca')
    expect(defaultLocaleOf({ defaultLocale: 'en' })).toBe('en')
  })
  it('seedOrderOf: el per defecte primer, després el catàleg', () => {
    expect(seedOrderOf({ defaultLocale: 'es' })).toEqual(['es', 'ca', 'en'])
    expect(seedOrderOf({ defaultLocale: 'ca' })).toEqual(['ca', 'es', 'en'])
    expect(seedOrderOf({ defaultLocale: 'en' })).toEqual(['en', 'es', 'ca'])
  })
  it('defineSiteConfig és la identitat', () => {
    const c = { themeColor: { dark: '#000000', light: '#ffffff' } } as Parameters<typeof defineSiteConfig>[0]
    expect(defineSiteConfig(c)).toBe(c)
  })
})
