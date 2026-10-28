import { c15tInstance, policyBuilder } from '@c15t/backend'
import { kyselyAdapter } from '@c15t/backend/db/adapters/kysely'
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'

import { siteConfig } from 'subur-site-config'
import { getServerSideURL } from '../utilities/getURL.js'

import { consentMessages } from './messages.js'
import { CONSENT_VALIDITY_DAYS } from './retention.js'

/**
 * Backend de consentiment de c15t dins de la mateixa web (spec §21.2): mateix
 * origen, registres a la base del client (taules `c15t_*`), dins de les
 * còpies i del traspàs. Pool propi i petit: no s'acobla al del CMS.
 * `disableGeoLocation`: la política és la mateixa per a tothom (GDPR).
 * Les taules les crea la cadena de migracions del CMS, mai aquest codi.
 *
 * `kyselyAdapter` instal·lat (fumadb 0.3.0, re-exportat per @c15t/backend)
 * exigeix `{ db, provider }`, no la instància `Kysely` sola com mostren la
 * quickstart i el guide de `database-setup.md` del paquet: `KyselyConfig` a
 * `fumadb/dist/create-DLpDB9NZ.d.ts` declara `db: Kysely<any>` i
 * `provider: SQLProvider`.
 */
let instance: ReturnType<typeof c15tInstance> | undefined

export function getConsentBackend() {
  if (!instance) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    // Sense aquest handler, un error de connexió al pool (xarxa, Postgres
    // reiniciant-se) és un `EventEmitter` sense listener: Node el tracta com
    // una excepció no capturada i tomba el procés. Només el missatge: mai la
    // connection string (porta la contrasenya).
    pool.on('error', (err) => {
      console.error('c15t: error al pool de connexions', err instanceof Error ? err.message : err)
    })
    const db = new Kysely({ dialect: new PostgresDialect({ pool }) })
    instance = c15tInstance({
      adapter: kyselyAdapter({ db, provider: 'postgresql' }),
      appName: siteConfig.name,
      basePath: '/api/c15t',
      disableGeoLocation: true,
      // Cap especificació OpenAPI pública (`/spec.json`, `/docs`; `createOpenAPIConfig` a `@c15t/backend/dist/core.js`):
      // publicava la forma de l'API sense cap ús. Decisió del 2026-10-26 (pla E2, R13).
      openapi: { enabled: false },
      // Idiomes que `/init` pot respondre: els del perfil `default`, amb els mateixos textos que el client
      // (`./messages.ts`). `I18nOptions.messages` a `dist-types/types/index.d.ts` (221–246); amb un perfil configurat,
      // `getTranslationsData` (`dist/261.js`, 84–131) tria només entre les seves llengües, amb l'anglès de reserva
      // (`I18nMessageProfile.fallbackLanguage`, per defecte `en`), i fusiona el text sobre la base de
      // `baseTranslations`, que no té `ca`. No toca l'empremta de la política (`createMaterialPolicyFingerprintInput`,
      // `@c15t/schema/dist/450.js`): canviar-lo no torna a demanar el consentiment.
      i18n: { messages: { default: { translations: consentMessages } } },
      // Caddy (`reverse_proxy`, sense `header_up`) reescriu `X-Forwarded-For`
      // amb la IP real del client, però deixa passar qualsevol `X-Client-IP`
      // que el visitant enviï. L'ordre per defecte del paquet
      // (`node_modules/@c15t/backend/dist/core.js`, `DEFAULT_IP_HEADERS`)
      // prova `x-client-ip` ABANS que `x-forwarded-for`: sense fixar-ho,
      // qualsevol visitant pot falsificar la IP desada a `c15t_consent`
      // enviant la seva pròpia capçalera `X-Client-IP`. Restringit a
      // `x-forwarded-for` (l'`ipAddress.masking` per defecte `true` ja fa
      // l'emmascarament que documenta `consentiment.md`).
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
      // Política única, perquè cada registre nou porti `validUntil` (spec
      // §22.6): sense cap política, `validUntil` queda NULL
      // (`node_modules/@c15t/backend/dist/49.js`, només l'omple
      // `consent.expiryDays`). Llegits
      // `node_modules/@c15t/backend/docs/self-host/guides/policy-packs.md` i
      // `dist-types/policies/builder.d.ts`: amb `disableGeoLocation` el país
      // és `null` i, sense política `fallback`, resol la `default`
      // (`matchedBy: 'default'`). No canvia el bàner (comprovat: `/init` només
      // hi afegeix `policy` i `policyDecision`; traduccions, jurisdicció i
      // ubicació idèntiques; e2e de consentiment i d'analítica sense tocar):
      // `model: 'opt-in'` és el mateix que el client deduïa de `GDPR`, sense
      // `ui.mode` el client continua mostrant `banner`, sense `banner`/`dialog`
      // no restringeix botons, i amb `scopeMode` `permissive` (el valor per
      // defecte) les `categories` no amaguen cap categoria del bàner
      // (`c15t/dist/index.js`, `buildStoreUpdate`).
      //
      // ATENCIÓ: canviar aquesta política torna a demanar el consentiment a
      // TOTHOM. El client desa amb cada decisió una empremta de la política
      // (`materialPolicyFingerprint`); a cada `/init` la compara amb la de la
      // política vigent i, si no coincideix, esborra la decisió desada i torna
      // a mostrar el bàner (`c15t/dist/index.js`, `updateStore`). L'empremta
      // inclou `model`, `expiryDays`, `scopeMode`, `categories`,
      // `preselectedCategories`, `gpc`, `ui` i `proof`
      // (`@c15t/schema/dist/450.js`, `createMaterialPolicyFingerprintInput`).
      // Per tant, canviar `CONSENT_VALIDITY_DAYS` o les `categories` reinicia
      // el consentiment de tots els visitants. (Les decisions d'abans d'aquesta
      // política no en portaven cap: el client n'hi va afegir una en silenci,
      // per això introduir-la no ha tornat a mostrar el bàner.) Les
      // `categories` hi són perquè la decisió desada a
      // `c15t_runtimePolicyDecision` digui quines s'oferien; afegir una
      // categoria a `Consent.tsx` ja obliga a tornar a demanar el
      // consentiment, i aleshores s'afegeix també aquí.
      policyPacks: policyBuilder.createPackWithDefault([], {
        categories: ['necessary', 'measurement'],
        expiryDays: CONSENT_VALIDITY_DAYS,
        id: 'default',
        model: 'opt-in',
      }),
      tablePrefix: 'c15t_',
      trustedOrigins: [getServerSideURL()],
    })
  }
  return instance
}
