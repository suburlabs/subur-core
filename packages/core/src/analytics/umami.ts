import { umamiAnalytics } from '@c15t/scripts/umami-analytics'

// `umamiConfig` viu a un mòdul sense dependències perquè el graf de configuració (`plugins/index.ts`) el carrega
// sense passar per `@c15t/scripts`, que en temps d'execució importa `c15t` (`dist/engine/runtime.js`).
import { type Env, umamiConfig } from './umamiConfig.js'

export { umamiConfig }

/** L'únic lloc on l'script d'Umami existeix: sota la categoria `measurement` de c15t. */
export const umamiScripts = (env: Env): Array<ReturnType<typeof umamiAnalytics>> => {
  const cfg = umamiConfig(env)
  if (!cfg) return []
  const hostUrl = new URL(cfg.scriptUrl).origin
  return [umamiAnalytics({ hostUrl, scriptUrl: cfg.scriptUrl, websiteId: cfg.websiteId })]
}
