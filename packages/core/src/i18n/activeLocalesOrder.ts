import { type Locale, locales } from './config.js'

/**
 * L'idioma per defecte sempre hi és i va primer; la resta, en l'ordre del
 * catàleg. Els codis que no són del catàleg s'ignoren.
 */
export function sortActiveLocales(active: readonly string[], defaultLocale: Locale): Locale[] {
  const rest = locales.filter((code) => code !== defaultLocale && active.includes(code))
  return [defaultLocale, ...rest]
}
