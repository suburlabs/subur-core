import type { Block } from 'payload'

import { iconField } from '../../fields/icon.js'
import { adminLabel } from '../../i18n/adminLabel.js'

export const taskCatalogBlock: Block = {
  slug: 'taskCatalog',
  interfaceName: 'TaskCatalogBlock',
  // Els noms del bloc i dels camps de dins els aprova el propietari del
  // producte: es tradueixen, no es renombren (esmena de revisió de la
  // Tasca 8, ronda 1).
  labels: {
    plural: adminLabel({ ca: 'Catàlegs de treballs', en: 'Job catalogues', es: 'Catálogos de trabajos' }),
    singular: adminLabel({ ca: 'Catàleg de treballs', en: 'Job catalogue', es: 'Catálogo de trabajos' }),
  },
  imageURL: '/_subur/blocks/taskCatalog.webp',
  imageAltText: 'Catálogo de trabajos por categoría',
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: adminLabel({ ca: 'Títol', en: 'Title', es: 'Título' }),
      localized: true,
    },
    {
      name: 'intro',
      type: 'textarea',
      label: adminLabel({ ca: 'Introducció', en: 'Introduction', es: 'Introducción' }),
      localized: true,
    },
    {
      name: 'groups',
      type: 'array',
      fields: [
        iconField({ required: true }),
        {
          name: 'title',
          type: 'text',
          label: adminLabel({ ca: 'Categoria', en: 'Category', es: 'Categoría' }),
          localized: true,
          required: true,
        },
        {
          name: 'tasks',
          type: 'array',
          fields: [
            {
              name: 'text',
              type: 'text',
              label: adminLabel({ ca: 'Treball', en: 'Job', es: 'Trabajo' }),
              localized: true,
              required: true,
            },
          ],
          label: adminLabel({ ca: 'Treballs', en: 'Jobs', es: 'Trabajos' }),
          labels: {
            plural: adminLabel({ ca: 'Treballs', en: 'Jobs', es: 'Trabajos' }),
            singular: adminLabel({ ca: 'Treball', en: 'Job', es: 'Trabajo' }),
          },
          minRows: 1,
          required: true,
        },
      ],
      label: adminLabel({ ca: 'Categories', en: 'Categories', es: 'Categorías' }),
      labels: {
        plural: adminLabel({ ca: 'Categories', en: 'Categories', es: 'Categorías' }),
        singular: adminLabel({ ca: 'Categoria', en: 'Category', es: 'Categoría' }),
      },
      minRows: 1,
      required: true,
    },
    {
      name: 'footnote',
      type: 'textarea',
      label: adminLabel({ ca: 'Nota final', en: 'Closing note', es: 'Nota final' }),
      localized: true,
    },
  ],
}
