import type { CheckboxField, CollectionConfig } from 'payload'
import { slugField } from 'payload'

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

import { authenticated } from '../access/authenticated.js'
import { authenticatedOrPublished } from '../access/authenticatedOrPublished.js'
import { allLayoutBlocks, enabledBlockSlugs } from '../blocks/registry.js'
import { invalidateAfterChange, invalidateAfterDelete } from '../hooks/invalidateSiteCache.js'
import { populatePublishedAt } from '../hooks/populatePublishedAt.js'
import { adminLabel } from '../i18n/adminLabel.js'
import { defaultLocaleOf, type SiteConfig } from '../site/index.js'
import { generatePreviewPath } from '../utilities/generatePreviewPath.js'

/**
 * La col·lecció de pàgines d'un client. Tots els blocs hi són sempre registrats (spec §3.3: un sol esquema per a
 * tots els clients); `optionalBlocks` només decideix quins pot afegir l'editor (`filterOptions`, que el motor
 * també valida en desar).
 */
export function createPages(siteConfig: SiteConfig): CollectionConfig<'pages'> {
  const defaultLocale = defaultLocaleOf(siteConfig)
  return {
    slug: 'pages',
    access: {
      create: authenticated,
      delete: authenticated,
      read: authenticatedOrPublished,
      update: authenticated,
    },
    admin: {
      defaultColumns: ['title', 'slug', 'updatedAt'],
      livePreview: {
        url: ({ data, req }) => generatePreviewPath({ defaultLocale, req, slug: data?.slug }),
      },
      preview: (data, { req }) =>
        generatePreviewPath({ defaultLocale, req, slug: data?.slug as string }),
      useAsTitle: 'title',
    },
    defaultPopulate: {
      slug: true,
      title: true,
    },
    labels: {
      plural: adminLabel({ ca: 'Pàgines', en: 'Pages', es: 'Páginas' }),
      singular: adminLabel({ ca: 'Pàgina', en: 'Page', es: 'Página' }),
    },
    fields: [
      {
        name: 'title',
        type: 'text',
        label: adminLabel({ ca: 'Títol', en: 'Title', es: 'Título' }),
        localized: true,
        required: true,
      },
      {
        type: 'tabs',
        tabs: [
          {
            label: adminLabel({ ca: 'Contingut', en: 'Content', es: 'Contenido' }),
            fields: [
              {
                name: 'layout',
                type: 'blocks',
                admin: { initCollapsed: true },
                blocks: allLayoutBlocks,
                filterOptions: () => enabledBlockSlugs(siteConfig.optionalBlocks),
                label: adminLabel({ ca: 'Blocs', en: 'Blocks', es: 'Bloques' }),
                labels: {
                  plural: adminLabel({ ca: 'Blocs', en: 'Blocks', es: 'Bloques' }),
                  singular: adminLabel({ ca: 'Bloc', en: 'Block', es: 'Bloque' }),
                },
                required: true,
              },
            ],
          },
          {
            name: 'meta',
            label: adminLabel({ ca: 'SEO', en: 'SEO', es: 'SEO' }),
            fields: [
              OverviewField({
                descriptionPath: 'meta.description',
                imagePath: 'meta.image',
                overrides: {
                  label: adminLabel({ ca: 'Resum', en: 'Overview', es: 'Resumen' }),
                },
                titlePath: 'meta.title',
              }),
              { ...MetaTitleField({ hasGenerateFn: true }), localized: true },
              {
                ...MetaImageField({
                  relationTo: 'media',
                  overrides: {
                    admin: {
                      // Es repeteix el cablatge del component del fabricant
                      // (mateix `path` i `clientProps`): l'`overrides` del
                      // fabricant substitueix `admin` sencer, no el fusiona.
                      components: {
                        Field: {
                          clientProps: { hasGenerateImageFn: false },
                          path: '@payloadcms/plugin-seo/client#MetaImageComponent',
                        },
                      },
                      description: adminLabel({
                        ca: 'Mida màxima de pujada: 12 MB. Mida recomanada per a les imatges: menys de 500 KB.',
                        en: 'Maximum upload size: 12 MB. Recommended image size: under 500 KB.',
                        es: 'Tamaño máximo de subida: 12 MB. Tamaño recomendado para las imágenes: menos de 500 KB.',
                      }),
                    },
                    label: adminLabel({ ca: 'Imatge (SEO)', en: 'SEO image', es: 'Imagen (SEO)' }),
                  },
                }),
                localized: true,
              },
              { ...MetaDescriptionField({}), localized: true },
              PreviewField({
                descriptionPath: 'meta.description',
                hasGenerateFn: true,
                overrides: {
                  label: adminLabel({ ca: 'Vista prèvia', en: 'Preview', es: 'Vista previa' }),
                },
                titlePath: 'meta.title',
              }),
            ],
          },
        ],
      },
      {
        name: 'publishedAt',
        type: 'date',
        admin: { position: 'sidebar' },
        label: adminLabel({
          ca: 'Data de publicació',
          en: 'Publication date',
          es: 'Fecha de publicación',
        }),
      },
      slugField({
        overrides: (field) => {
          // El primer camp de la fila és el checkbox `generateSlug`: es tipa
          // explícitament perquè `field.fields[0]` és `Field` (la unió
          // sencera) i estendre'l tal qual confonia `tsc`.
          const generateSlugCheckbox = field.fields[0] as CheckboxField
          return {
            ...field,
            fields: [
              {
                ...generateSlugCheckbox,
                admin: {
                  ...generateSlugCheckbox.admin,
                  description: adminLabel({
                    ca: 'Si està activada, el slug es genera automàticament a partir del títol en desar i autodesar.',
                    en: 'When enabled, the slug is generated automatically from the title field on save and autosave.',
                    es: 'Si está activada, el slug se genera automáticamente a partir del título al guardar y autoguardar.',
                  }),
                },
              },
              field.fields[1],
            ],
          }
        },
      }),
    ],
    hooks: {
      afterChange: [invalidateAfterChange],
      afterDelete: [invalidateAfterDelete],
      beforeChange: [populatePublishedAt],
    },
    versions: {
      drafts: {
        autosave: { interval: 100 },
        schedulePublish: true,
      },
      maxPerDoc: 50,
    },
  }
}
