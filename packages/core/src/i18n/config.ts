import { catalogLocales, type SupportedLocale } from './catalog.js'

export type Locale = SupportedLocale

/** El catàleg sencer. Els idiomes actius d'una web els dóna `getActiveLocales` (`app/siteData.ts`) a partir del global `subscription`. */
export const locales: readonly Locale[] = catalogLocales

export const LOCALE_COOKIE = 'NEXT_LOCALE'

export const isLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value)
