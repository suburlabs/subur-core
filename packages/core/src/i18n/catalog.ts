/**
 * Els idiomes que Subur ofereix. És del nucli, no de cada client: totes les
 * webs tenen el mateix esquema i activar-ne un és una casella al global
 * `subscription`, no una migració. Afegir-ne un aquí és un canvi del nucli
 * (amb migració) que arriba a totes les webs.
 */
export const supportedLocales = {
  ca: { hreflang: 'ca', name: 'Català', og: 'ca_ES' },
  en: { hreflang: 'en', name: 'English', og: 'en_GB' },
  es: { hreflang: 'es', name: 'Español', og: 'es_ES' },
} as const

export type SupportedLocale = keyof typeof supportedLocales

/** Ordre de presentació del catàleg (selector del panell i de la web). */
export const catalogLocales = ['es', 'ca', 'en'] as const satisfies readonly SupportedLocale[]
