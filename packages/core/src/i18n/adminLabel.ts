import type { SupportedLocale } from './catalog.js'

/**
 * Una etiqueta del panell en tots els idiomes del catàleg. El panell la mostra
 * en l'idioma d'admin de cada usuari. És una funció d'identitat: existeix
 * perquè el tipus obligui a escriure tots els idiomes, de manera que afegir-ne
 * un al catàleg faci fallar `tsc` a cada etiqueta que encara no el tingui.
 */
export type AdminLabel = Record<SupportedLocale, string>

export const adminLabel = (label: AdminLabel): AdminLabel => label
