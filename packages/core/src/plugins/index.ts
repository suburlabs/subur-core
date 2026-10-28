import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import type { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import type { Plugin } from 'payload'

import { isSuperAdmin } from '../access/roles.js'
import { umamiConfig } from '../analytics/umamiConfig.js'
import { invalidateAfterChange, invalidateAfterDelete } from '../hooks/invalidateSiteCache.js'
import { adminLabel } from '../i18n/adminLabel.js'
import { isLocale } from '../i18n/config.js'
import { pageHref } from '../i18n/paths.js'
import { defaultLocaleOf, type SiteConfig } from '../site/index.js'
import { s3Storage } from '../storage/s3.js'
import type { Page } from '../types/subur-types.js'
import { getServerSideURL } from '../utilities/getURL.js'

/** El títol i l'URL que proposa el camp SEO: el nom de la web i l'idioma per defecte surten de l'argument. */
export const seoGenerators = (
  siteConfig: SiteConfig,
): { generateTitle: GenerateTitle<Page>; generateURL: GenerateURL<Page> } => {
  const generateTitle: GenerateTitle<Page> = ({ doc }) =>
    doc?.title ? `${doc.title} | ${siteConfig.name}` : siteConfig.name
  const generateURL: GenerateURL<Page> = ({ doc, locale }) => {
    const resolved = locale && isLocale(locale) ? locale : defaultLocaleOf(siteConfig)
    return `${getServerSideURL()}${pageHref(resolved, doc?.slug || 'home')}`
  }
  return { generateTitle, generateURL }
}

// Grup compartit de `forms` i `formSubmissions` a la barra lateral: una sola
// definició perquè `formSubmissions.group` no dupliqui el literal de
// `forms.group` (esmena de revisió de la Tasca 8, ronda 1).
const formsGroup = adminLabel({ ca: 'Formularis', en: 'Forms', es: 'Formularios' })

/**
 * Etiquetes i grups que apliquem a les col·leccions dels plugins (els seus
 * propis camps ja són conscients de l'idioma d'admin: veure el comentari
 * sobre `formOverrides`/`formSubmissionOverrides` més avall). `redirects`
 * comparteix grup amb `forms`/`form-submissions` a la barra lateral.
 */
export const pluginLabels = {
  forms: {
    group: formsGroup,
    labels: {
      plural: adminLabel({ ca: 'Formularis', en: 'Forms', es: 'Formularios' }),
      singular: adminLabel({ ca: 'Formulari', en: 'Form', es: 'Formulario' }),
    },
  },
  formSubmissions: {
    group: formsGroup,
    labels: {
      plural: adminLabel({ ca: 'Enviaments de formulari', en: 'Form submissions', es: 'Envíos de formularios' }),
      singular: adminLabel({ ca: 'Enviament de formulari', en: 'Form submission', es: 'Envío de formulario' }),
    },
  },
  redirects: {
    group: adminLabel({ ca: 'Configuració', en: 'Settings', es: 'Configuración' }),
    labels: {
      plural: adminLabel({ ca: 'Redireccions', en: 'Redirects', es: 'Redirecciones' }),
      singular: adminLabel({ ca: 'Redirecció', en: 'Redirect', es: 'Redirección' }),
    },
  },
}

// Umami (Tasca 3 del Pla H2, ruling R4 del coordinador): `umamiConfig` s'ha
// d'avaluar també al servidor, en arrencar/construir, no només al
// `ConsentProvider` del client (`src/providers/Consent.tsx`) — altrament una
// imatge amb només una variable `NEXT_PUBLIC_UMAMI_*` no falla fins al
// primer render, en lloc de fallar al build/boot.
//
// Aquest mòdul (`src/plugins/index.ts`) és el lloc: s'importa des de
// `src/config/index.ts` (`buildSuburConfig`), que es carrega tant a `next build` com en
// arrencar el servidor. `umamiConfig(process.env)` es queda a nivell de mòdul a
// propòsit: llança en carregar-lo. `s3Config` falla pel mateix camí però un
// moment després: `s3Config(env)` es crida dins `s3Storage()`, i `s3Storage()`
// es crida dins de l'array de `plugins(siteConfig)`, és a dir quan
// `buildSuburConfig` corre (també a `next build` i en arrencar el servidor).
//
// `umamiConfig` ve de `src/analytics/umamiConfig.ts`, sense cap import: el graf
// de configuració no passa per `@c15t/scripts/umami-analytics`, que en temps
// d'execució arriba a `c15t` (`dist/resolve.js` → `dist/engine/runtime.js`,
// `@c15t/scripts@2.2.0`) i no el declara com a dependència.
//
// Sentència solta a propòsit: NOMÉS pel seu efecte de llançar en carregar
// aquest mòdul; el valor de retorn es descarta expressament. No l'esborris
// pensant que és mort — `tests/int/umami.int.spec.ts` («al carregar
// @/plugins») importa aquest mòdul amb un entorn a mig configurar i falla si
// aquesta línia desapareix.
umamiConfig(process.env)

export function plugins(siteConfig: SiteConfig): Plugin[] {
  const { generateTitle, generateURL } = seoGenerators(siteConfig)
  return [
    redirectsPlugin({
      collections: ['pages'],
      overrides: {
        access: {
          create: isSuperAdmin,
          delete: isSuperAdmin,
          read: isSuperAdmin,
          update: isSuperAdmin,
        },
        admin: {
          group: pluginLabels.redirects.group,
          hidden: ({ user }) => user?.role !== 'superadmin',
        },
        hooks: {
          afterChange: [invalidateAfterChange],
          afterDelete: [invalidateAfterDelete],
        },
        labels: pluginLabels.redirects.labels,
      },
    }),
    seoPlugin({
      generateTitle,
      generateURL,
    }),
    formBuilderPlugin({
      fields: {
        checkbox: true,
        country: false,
        date: false,
        email: true,
        message: true,
        number: false,
        payment: false,
        select: false,
        state: false,
        text: true,
        textarea: true,
        upload: false,
      },
      formOverrides: {
        admin: { group: pluginLabels.forms.group },
        // Un formulari es pinta dins de les pàgines. `formSubmissionOverrides` no
        // porta el hook a propòsit: cada enviament públic buidaria la memòria cau.
        hooks: {
          afterChange: [invalidateAfterChange],
          afterDelete: [invalidateAfterDelete],
        },
        fields: ({ defaultFields }) =>
          defaultFields.map((field) => {
            if ('name' in field && field.name === 'confirmationMessage') {
              return {
                ...field,
                editor: lexicalEditor({
                  features: ({ rootFeatures }) => [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }),
                  ],
                }),
              }
            }
            return field
          }),
        // Els camps propis del formulari («Title», «Fields»…) ja arriben com a
        // funcions `({ t }) => t('plugin-form-builder:…')` que fan servir
        // l'i18n del propi CMS (`node_modules/.pnpm/@payloadcms+plugin-form-
        // builder@*/…/dist/translations/languages/{ca,en,es}.js` porten els
        // tres idiomes del catàleg): no es toquen.
        labels: pluginLabels.forms.labels,
      },
      formSubmissionOverrides: {
        admin: { group: pluginLabels.formSubmissions.group },
        labels: pluginLabels.formSubmissions.labels,
      },
      redirectRelationships: ['pages'],
    }),
    s3Storage(),
  ]
}
