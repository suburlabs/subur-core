import type { Block } from 'payload'

import { iconField } from '../../fields/icon.js'
import { adminLabel } from '../../i18n/adminLabel.js'

export const featureListBlock: Block = {
  slug: 'featureList',
  interfaceName: 'FeatureListBlock',
  labels: {
    plural: adminLabel({ ca: 'Llistes de característiques', en: 'Feature lists', es: 'Listas de características' }),
    singular: adminLabel({ ca: 'Llista de característiques', en: 'Feature list', es: 'Lista de características' }),
  },
  imageURL: '/_subur/blocks/featureList.webp',
  imageAltText: 'Lista de características con icono',
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
      name: 'columns',
      type: 'select',
      defaultValue: '2',
      label: adminLabel({ ca: 'Columnes', en: 'Columns', es: 'Columnas' }),
      options: [
        { label: adminLabel({ ca: '2 columnes', en: '2 columns', es: '2 columnas' }), value: '2' },
        { label: adminLabel({ ca: '4 columnes', en: '4 columns', es: '4 columnas' }), value: '4' },
      ],
      required: true,
    },
    {
      name: 'items',
      type: 'array',
      fields: [
        iconField({ required: true }),
        {
          name: 'title',
          type: 'text',
          label: adminLabel({ ca: 'Títol', en: 'Title', es: 'Título' }),
          localized: true,
          required: true,
        },
        {
          name: 'text',
          type: 'textarea',
          label: adminLabel({ ca: 'Text', en: 'Text', es: 'Texto' }),
          localized: true,
          required: true,
        },
        {
          name: 'moment',
          type: 'select',
          admin: {
            description: adminLabel({
              ca: 'Opcional. En quin moment de l’estada es fa.',
              en: 'Optional. What point of the stay this happens at.',
              es: 'Opcional. En qué momento de la estancia se hace.',
            }),
          },
          // El nom del camp l'aprova el propietari del producte: es tradueix,
          // no es renombra (esmena de revisió de la Tasca 8, ronda 1).
          label: adminLabel({ ca: 'Quan es fa', en: 'When it is done', es: 'Cuándo se hace' }),
          options: [
            { label: adminLabel({ ca: 'Abans de l’estada', en: 'Before the stay', es: 'Antes de la estancia' }), value: 'before' },
            { label: adminLabel({ ca: 'Durant l’estada', en: 'During the stay', es: 'Durante la estancia' }), value: 'during' },
            { label: adminLabel({ ca: 'Després de l’estada', en: 'After the stay', es: 'Después de la estancia' }), value: 'after' },
            { label: adminLabel({ ca: 'De manera contínua', en: 'Ongoing', es: 'De forma continua' }), value: 'ongoing' },
          ],
        },
      ],
      label: adminLabel({ ca: 'Elements', en: 'Items', es: 'Elementos' }),
      labels: {
        plural: adminLabel({ ca: 'Elements', en: 'Items', es: 'Elementos' }),
        singular: adminLabel({ ca: 'Element', en: 'Item', es: 'Elemento' }),
      },
      minRows: 1,
      required: true,
    },
  ],
}
