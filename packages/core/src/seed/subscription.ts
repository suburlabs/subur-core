import { existsSync } from 'node:fs'
import path from 'node:path'

import type { Locale } from '../i18n/config.js'
import { seedOrderOf, type SiteConfig } from '../site/index.js'
import { type Plan, readSuburContract, SUBUR_DIR } from '../subur/contract.js'

export type SeedSubscription = { activeLocales: Locale[]; footerCredit: boolean; maxLanguages: number; modules: string[]; plan: Plan }

/**
 * Pla, mòduls, límit d'idiomes i crèdit al peu surten de `.subur/` quan hi és (portàtil, CI),
 * i `activeLocales` és `seedOrderOf(siteConfig)` retallat al màxim del
 * contracte (el motor rebutjaria més idiomes actius que `maxLanguages`): el
 * mateix càlcul que `collectFacts`, perquè el que el seed escriu al global
 * sigui el que diuen els fets (ruling P8). Sense `.subur/` (la imatge `seed`
 * de producció, un paquet de traspàs) torna `null` i el seed no toca el
 * global: el fixen `pnpm ops deploy` i el panell, i sembrar-hi res esborraria
 * els idiomes actius del client.
 */
export function seedSubscription({
  log = console.warn,
  repoRoot,
  siteConfig,
}: {
  log?: (line: string) => void
  repoRoot: string
  siteConfig: SiteConfig
}): null | SeedSubscription {
  if (!existsSync(path.join(repoRoot, SUBUR_DIR))) {
    log(`Seed: sense ${SUBUR_DIR}/, la subscripció no es toca (la fixen pnpm ops deploy i el panell)`)
    return null
  }
  const contract = readSuburContract(repoRoot, siteConfig.id)
  return {
    activeLocales: seedOrderOf(siteConfig).slice(0, contract.maxLanguages),
    footerCredit: contract.footerCredit,
    maxLanguages: contract.maxLanguages,
    modules: contract.moduleIds,
    plan: contract.plan,
  }
}
