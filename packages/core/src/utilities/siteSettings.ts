import type { Locale } from '../i18n/config.js'
import { type ResolvedUi, resolveUi } from '../i18n/resolveUi.js'
import type { UiKey } from '../i18n/uiDefaults.js'
import type { SiteSettings } from '../types/subur-types.js'

export type ResolvedSiteSettings = Omit<SiteSettings, 'ui'> & { ui: ResolvedUi }

/**
 * Pur: cap configuració ni `next/*` (la lectura en cau és a `app/siteData.ts`). `overrides` són els textos `ui` llegits
 * SENSE *fallback* d'idioma: amb *fallback*, un text buit en anglès arribaria en castellà i mai es veuria el text per
 * defecte en anglès. La resta d'ajustos (adreça, horari) sí que fan *fallback*, com sempre.
 */
export function resolveSiteSettings(raw: SiteSettings, overrides: Partial<Record<UiKey, string | null>>, locale: Locale): ResolvedSiteSettings {
  return { ...raw, ui: resolveUi(overrides, locale) }
}
