import path from 'node:path'

import type { Facts, Locale } from '../subur/facts.js'

/** El que la porta prova per a un client, tret dels seus fets. */
export type GatePlan = {
  /** Els idiomes actius del client, en l'ordre dels fets: la porta escalfa, invalida i comprova `STALE` en cadascun. */
  locales: readonly Locale[]
  /** El primer idioma actiu: el dels passos 5 i 6. */
  primary: Locale
  primaryPath: string
  /** El primer pòster de la pel·lícula de la portada (pas 7), i el seu fitxer dins de `public/` del repositori. */
  poster: string
  posterFile: string
  imagePath: string
}

/** Pur: què prova la porta per a un client. Abans: tres idiomes, un camí i un pòster fixos al cos de la porta. */
export function gatePlan(facts: Facts, repo: string): GatePlan {
  const [primary] = facts.activeLocales
  if (!primary) throw new Error('gate: els fets no tenen cap idioma actiu (activeLocales buit)')
  const [poster] = facts.posters
  if (!poster) throw new Error('gate: els fets no tenen cap pòster (posters buit): el pas 7 prova la cau d\'imatges amb el primer')
  return {
    imagePath: `/_next/image?url=${encodeURIComponent(poster)}&w=640&q=100`,
    locales: [...facts.activeLocales],
    poster,
    posterFile: path.join(repo, 'public', poster),
    primary,
    primaryPath: `/${primary}`,
  }
}
