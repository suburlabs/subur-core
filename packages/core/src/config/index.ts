import { postgresAdapter } from '@payloadcms/db-postgres'
import { ca } from '@payloadcms/translations/languages/ca'
import { en } from '@payloadcms/translations/languages/en'
import { es } from '@payloadcms/translations/languages/es'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig, type PayloadRequest, type SanitizedConfig } from 'payload'
import sharp from 'sharp'

import { Media } from '../collections/Media.js'
import { Users } from '../collections/Users/index.js'
import { purgeExpiredConsentTask } from '../consent/purgeTask.js'
import { emailAdapter } from '../email/adapter.js'
import { healthEndpoint } from '../endpoints/health.js'
import { defaultLexical } from '../fields/defaultLexical.js'
import { Footer } from '../Footer/config.js'
import { Header } from '../Header/config.js'
import { adminTranslations } from '../i18n/adminTranslations.js'
import { supportedLocales } from '../i18n/catalog.js'
import { locales } from '../i18n/config.js'
import { filterAdminLocales } from '../i18n/filterAdminLocales.js'
import { migrations } from '../migrations/index.js'
import { plugins, seoGenerators } from '../plugins/index.js'
import { SiteSettings } from '../SiteSettings/config.js'
import { defaultLocaleOf, type SiteConfig } from '../site/index.js'
import { ensureSuperAdmin } from '../utilities/ensureSuperAdmin.js'
import { getServerSideURL } from '../utilities/getURL.js'
import { shouldRunMigrations } from '../utilities/migrationsGate.js'
import { createPages } from './pages.js'
import { createSubscription } from './subscription.js'

export { createPages, createSubscription, plugins, seoGenerators }
export const SUPPORT_EMAIL_DEFAULT = 'hola@subur.dev'
export type SuburConfigOptions = { baseDir: string; support?: { email: string } }

/**
 * Ruling P24, corregit a la ronda 2 (D1, D11, D26): el CLI del motor importa la configuració **abans** de posar
 * PAYLOAD_MIGRATING, així que qui vulgui escriure migracions a src/ ha de posar totes dues variables a l'entorn del procés
 * (ho fa core/scripts/migrate-create.ts). Cap imatge de producció corre aquest script ni posa aquestes variables.
 * Sense `new URL(…, import.meta.url)`: sota l'entorn jsdom de vitest, `URL` és el de jsdom i `fileURLToPath` el rebutja.
 */
export const migrationDirOf = (env: NodeJS.ProcessEnv): string =>
  (env.PAYLOAD_MIGRATING === 'true' && env.SUBUR_MIGRATIONS_SRC) || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations')

/**
 * La configuració sencera del CMS d'un client a partir de la seva `siteConfig` (spec §3.2.1). `baseDir` és el `src/`
 * del client: hi viuen l'`importMap` del panell i els seus components.
 */
export function buildSuburConfig(siteConfig: SiteConfig, { baseDir, support }: SuburConfigOptions): Promise<SanitizedConfig> {
  const defaultLocale = defaultLocaleOf(siteConfig)
  const supportEmail = support?.email ?? SUPPORT_EMAIL_DEFAULT
  return buildConfig({
    admin: {
      // Zona horària del panell (programador de publicacions, dates): la nostra per
      // defecte, i a la llista Madrid/Barcelona i Canàries davant de la llista del motor.
      timezones: {
        defaultTimezone: 'Europe/Madrid',
        supportedTimezones: ({ defaultTimezones }) => [
          { label: '(UTC+01:00) Madrid, Barcelona', value: 'Europe/Madrid' },
          { label: '(UTC+00:00) Canàries', value: 'Atlantic/Canary' },
          ...defaultTimezones.filter((tz) => tz.value !== 'Europe/Madrid' && tz.value !== 'Atlantic/Canary'),
        ],
      },
      // Components del panell per especificador del paquet: l'`importMap` del client els importa de `@suburlabs/core/admin`.
      components: {
        beforeDashboard: [{ path: '@suburlabs/core/admin#BeforeDashboard', serverProps: { supportEmail } }],
        graphics: { Icon: '@suburlabs/core/admin#AdminIcon', Logo: '@suburlabs/core/admin#AdminLogo' },
      },
      importMap: { baseDir, importMapFile: path.resolve(baseDir, 'app/(subur)/admin/importMap.js') },
      livePreview: {
        breakpoints: [
          { height: 667, label: 'Móvil', name: 'mobile', width: 375 },
          { height: 1024, label: 'Tableta', name: 'tablet', width: 768 },
          { height: 900, label: 'Escritorio', name: 'desktop', width: 1440 },
        ],
      },
      meta: { icons: [{ rel: 'icon', type: 'image/png', url: '/_subur/icons/web-app-manifest-192x192.png' }], titleSuffix: '— Subur' },
      user: Users.slug,
    },
    collections: [createPages(siteConfig), Media, Users],
    cookiePrefix: 'subur',
    cors: [getServerSideURL()].filter(Boolean),
    db: postgresAdapter({
      migrationDir: migrationDirOf(process.env),
      pool: { connectionString: process.env.DATABASE_URL || '' },
      // `next build` també posa NODE_ENV=production, però durant la fase de build
      // no hi ha cap servidor escoltant peticions: les migracions han d'aplicar-se
      // quan el servidor arrenca, no contra la base de dades que es trobi el build.
      // `SUBUR_RUN_MIGRATIONS=1` el posen només els serveis `web` i `seed` del
      // compose del client: cap `pnpm build` ni `pnpm dev` local el defineix mai.
      prodMigrations: shouldRunMigrations(process.env) ? migrations : undefined,
      // Les migracions són l'única font de veritat de l'esquema, també en
      // desenvolupament: un canvi sense migració falla al primer `pnpm dev`,
      // no al desplegament. (Pla G, spec §19.3.)
      push: false,
    }),
    editor: defaultLexical,
    email: emailAdapter(),
    endpoints: [healthEndpoint],
    globals: [SiteSettings, Header, Footer, createSubscription(siteConfig)],
    i18n: { fallbackLanguage: defaultLocale, supportedLanguages: { ca, en, es }, translations: adminTranslations(supportEmail) },
    jobs: {
      access: {
        run: ({ req }: { req: PayloadRequest }): boolean => {
          if (req.user) return true
          const secret = process.env.CRON_SECRET
          if (!secret) return false
          return req.headers.get('authorization') === `Bearer ${secret}`
        },
      },
      // `autoRun` només executa el que ja és a la cua (i, abans, hi posa el que
      // toca segons el `schedule` de cada tasca de la mateixa cua): per a
      // `maintenance` cada 10 min n'hi ha prou, i amb la cua buida no fa res. Tipus a
      // `payload/dist/queues/config/types/index.d.ts` (`AutorunCronConfig`):
      // `limit` per defecte 10, més que de sobres per a una tasca diària; sense
      // `shouldAutoRun`, que per defecte deixa córrer sempre. Els crons els
      // engega la primera petició a l'API del CMS (`/api/health` del
      // HEALTHCHECK, cada 30 s), mai el build.
      //
      // Les publicacions programades (`schedulePublish`, el botó «Programar» del
      // panell de `pages`) s'encuen sense nom de cua, és a dir a `default`
      // (`@payloadcms/ui/dist/utilities/schedulePublishHandler.js`: `jobs.queue`
      // sense `queue`; `payload/dist/queues/config/collection.js`: `defaultValue:
      // 'default'`), i cada entrada d'`autoRun` només buida la seva cua
      // (`payload/dist/index.js`, `jobs.run({ queue: cronConfig.queue })`): sense
      // la segona entrada no es publicarien mai. Corre cada minut perquè una
      // publicació programada no surti fins a 10 min tard; amb la cua buida el
      // corredor torna sense fer res.
      autoRun: [
        { cron: '*/10 * * * *', queue: 'maintenance' },
        { cron: '* * * * *', queue: 'default' },
      ],
      tasks: [purgeExpiredConsentTask],
    },
    localization: {
      defaultLocale,
      fallback: true,
      filterAvailableLocales: filterAdminLocales,
      locales: locales.map((code) => ({ code, label: supportedLocales[code].name })),
    },
    onInit: async (payload) => {
      await ensureSuperAdmin(payload)
    },
    plugins: plugins(siteConfig),
    secret: process.env.SUBUR_SECRET,
    sharp,
    // Els tipus són els del paquet (`src/types/subur-types.ts`): el client no en genera en arrencar.
    typescript: { autoGenerate: false },
  })
}
