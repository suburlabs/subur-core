import { catalogLocales, type SupportedLocale, supportedLocales } from '../i18n/catalog.js'
import type { SiteConfig } from '../utilities/defineSiteConfig.js'

export type Locale = SupportedLocale
export type { SiteConfig }
export { supportedLocales }
export const locales: readonly Locale[] = catalogLocales
export const defineSiteConfig = (config: SiteConfig): SiteConfig => config
export const defaultLocaleOf = (siteConfig: Pick<SiteConfig, 'defaultLocale'>): Locale => siteConfig.defaultLocale
export const seedOrderOf = (siteConfig: Pick<SiteConfig, 'defaultLocale'>): Locale[] => {
  const first = defaultLocaleOf(siteConfig)
  return [first, ...locales.filter((code) => code !== first)]
}
