import type { Locale } from '../i18n/config.js'
import type { ResolvedSiteSettings } from '../utilities/siteSettings.js'

export type BlockContext = {
  locale: Locale
  settings: ResolvedSiteSettings
}
