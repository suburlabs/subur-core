import { cache } from 'react'
import { siteConfig } from 'subur-site-config'

import { defaultLocaleOf } from '../site/index.js'
import type { Locale } from './config.js'

/**
 * `not-found.tsx` no rep `params`, i llegir l'idioma de `headers()` fa
 * dinàmica tota la ruta (Next renderitza la 404 juntament amb cada pàgina).
 * `cache` de React dona un objecte per render de servidor: el layout de
 * `[locale]` hi desa l'idioma abans de retornar el seu arbre, i la 404, que
 * es renderitza dins d'aquell arbre, el llegeix sense tocar la petició.
 * Sense cap valor desat, l'idioma per defecte del client (`subur-site-config`).
 */
const store = cache((): { locale: Locale } => ({ locale: defaultLocaleOf(siteConfig) }))

export const setRequestLocale = (locale: Locale): void => {
  store().locale = locale
}

export const getRequestLocale = (): Locale => store().locale
