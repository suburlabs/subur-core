import { type Locale, locales } from '../i18n/config.js'

/**
 * Aquest `validate` personalitzat substitueix el validador integrat del camp
 * `select` (el CMS només instal·la el seu quan `field.validate` és `undefined`),
 * així que aquí es tornen a comprovar la pertinença al catàleg i els duplicats,
 * a més de les regles pròpies del negoci i el límit d'idiomes del contracte.
 */
export const validateActiveLocales =
  (defaultLocale: Locale) =>
  (value: unknown, maxLanguages?: unknown): string | true => {
    if (!Array.isArray(value) || value.length === 0) return 'Active al menos un idioma.'

    for (const item of value) {
      if (typeof item !== 'string' || !(locales as readonly string[]).includes(item)) {
        return `Idioma no disponible en el catálogo: ${String(item)}.`
      }
    }

    if (new Set(value).size !== value.length) {
      return 'Hay idiomas repetidos.'
    }

    if (!value.includes(defaultLocale)) {
      return `El idioma por defecto (${defaultLocale}) debe estar activo.`
    }

    // El límit del contracte (`modules.limits.languages`); sense valor vàlid (base antiga), no bloqueja.
    if (
      Number.isInteger(maxLanguages) &&
      (maxLanguages as number) >= 1 &&
      value.length > (maxLanguages as number)
    ) {
      return `El contrato permite como máximo ${maxLanguages} idiomas activos.`
    }
    return true
  }
