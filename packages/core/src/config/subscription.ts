import type { GlobalConfig } from 'payload'

import { isSuperAdmin } from '../access/roles.js'
import { invalidateGlobalAfterChange } from '../hooks/invalidateSiteCache.js'
import { adminLabel } from '../i18n/adminLabel.js'
import { supportedLocales } from '../i18n/catalog.js'
import { locales } from '../i18n/config.js'
import { defaultLocaleOf, type SiteConfig } from '../site/index.js'
import { validateActiveLocales } from '../Subscription/validateActiveLocales.js'

/**
 * El que aquesta web té contractat. Només el veu i l'edita Subur. La web el
 * llegeix amb l'API local, que no passa pel control d'accés. `plan`, `modules`
 * i `maxLanguages` són un mirall del contracte (`.subur/`, spec §25.5) que
 * escriu `pnpm ops deploy`: al panell són de només lectura. L'idioma per defecte
 * (sempre actiu) surt de la configuració del client. `footerCredit` també surt
 * del contracte, però es deixa editable pel superadministrador a posta: després
 * del traspàs el crèdit es treu des del panell (spec §0.5).
 */
export function createSubscription(siteConfig: SiteConfig): GlobalConfig {
  const defaultLocale = defaultLocaleOf(siteConfig)
  return {
    slug: 'subscription',
    access: {
      read: isSuperAdmin,
      update: isSuperAdmin,
    },
    admin: {
      group: adminLabel({ ca: 'Subur', en: 'Subur', es: 'Subur' }),
      hidden: ({ user }) => user?.role !== 'superadmin',
    },
    typescript: { interface: 'Subscription' },
    label: adminLabel({ ca: 'Subscripció', en: 'Subscription', es: 'Suscripción' }),
    fields: [
      {
        name: 'plan',
        type: 'select',
        admin: {
          description: adminLabel({
            ca: 'L’escriu Subur des del contracte (pnpm ops deploy).',
            en: 'Written by Subur from the contract (pnpm ops deploy).',
            es: 'Lo escribe Subur desde el contrato (pnpm ops deploy).',
          }),
          readOnly: true,
        },
        defaultValue: 'starter',
        label: adminLabel({ ca: 'Pla', en: 'Plan', es: 'Plan' }),
        options: [
          {
            label: adminLabel({ ca: 'Starter', en: 'Starter', es: 'Starter' }),
            value: 'starter',
          },
          {
            label: adminLabel({ ca: 'Business', en: 'Business', es: 'Business' }),
            value: 'business',
          },
        ],
        required: true,
      },
      {
        name: 'activeLocales',
        type: 'select',
        admin: {
          description: adminLabel({
            ca: 'Idiomes contractats. Activar-ne un no requereix desplegar: el web l’ofereix tan bon punt es desa.',
            en: 'Contracted languages. Activating one does not require a deployment: the site offers it as soon as it is saved.',
            es: 'Idiomas contratados. Activar uno no requiere desplegar: la web lo ofrece en cuanto se guarda.',
          }),
        },
        defaultValue: [defaultLocale],
        hasMany: true,
        label: adminLabel({ ca: 'Idiomes actius', en: 'Active locales', es: 'Idiomas activos' }),
        options: locales.map((code) => ({
          label: adminLabel({
            ca: supportedLocales[code].name,
            en: supportedLocales[code].name,
            es: supportedLocales[code].name,
          }),
          value: code,
        })),
        required: true,
        // `siblingData` porta el valor entrant o el desat; sense `maxLanguages`, cap límit conegut.
        validate: (value: unknown, { siblingData }: { siblingData?: { maxLanguages?: unknown } }) =>
          validateActiveLocales(defaultLocale)(value, siblingData?.maxLanguages),
      },
      {
        name: 'modules',
        type: 'text',
        admin: {
          description: adminLabel({
            ca: 'Mòduls contractats (ids del catàleg de Subur). Els escriu Subur des del contracte.',
            en: 'Contracted modules (Subur catalogue ids). Written by Subur from the contract.',
            es: 'Módulos contratados (ids del catálogo de Subur). Los escribe Subur desde el contrato.',
          }),
          readOnly: true,
        },
        defaultValue: [],
        hasMany: true,
        label: adminLabel({ ca: 'Mòduls', en: 'Modules', es: 'Módulos' }),
      },
      {
        name: 'maxLanguages',
        type: 'number',
        admin: {
          description: adminLabel({
            ca: 'Màxim d’idiomes actius segons el contracte.',
            en: 'Maximum active languages under the contract.',
            es: 'Máximo de idiomas activos según el contrato.',
          }),
          readOnly: true,
        },
        defaultValue: 1,
        label: adminLabel({
          ca: 'Màxim d’idiomes',
          en: 'Maximum languages',
          es: 'Máximo de idiomas',
        }),
        min: 1,
        required: true,
      },
      {
        // El crèdit «Web feta per Subur» al peu (spec §0.5): és del contracte (`.subur/contract.json`), l'escriu el seed
        // (i, a E3b, `pnpm ops deploy`). Com la resta del global, només el pot canviar un superadministrador
        // (`access.update` del global). Per defecte, fals: la columna nova no encén el crèdit a cap web (spec §3.3).
        name: 'footerCredit',
        type: 'checkbox',
        admin: {
          description: adminLabel({
            ca: 'Mostra «Web feta per Subur» al peu. L’escriu Subur des del contracte.',
            en: 'Shows “Website by Subur” in the footer. Written by Subur from the contract.',
            es: 'Muestra «Web hecha por Subur» en el pie. Lo escribe Subur desde el contrato.',
          }),
        },
        defaultValue: false,
        label: adminLabel({ ca: 'Crèdit al peu', en: 'Footer credit', es: 'Crédito en el pie' }),
      },
    ],
    hooks: {
      afterChange: [invalidateGlobalAfterChange],
    },
  }
}
