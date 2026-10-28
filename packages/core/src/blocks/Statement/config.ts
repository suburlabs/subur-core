import type { Block } from 'payload'

import { adminLabel } from '../../i18n/adminLabel.js'

export const statementBlock: Block = {
  slug: 'statement',
  interfaceName: 'StatementBlock',
  labels: {
    plural: adminLabel({ ca: 'Frases destacades', en: 'Highlighted statements', es: 'Frases destacadas' }),
    singular: adminLabel({ ca: 'Frase destacada', en: 'Highlighted statement', es: 'Frase destacada' }),
  },
  imageURL: '/_subur/blocks/statement.webp',
  imageAltText: 'Frase destacada a gran tamaño',
  fields: [
    {
      name: 'text',
      type: 'textarea',
      label: adminLabel({ ca: 'Frase', en: 'Statement', es: 'Frase' }),
      localized: true,
      required: true,
    },
    {
      name: 'supporting',
      type: 'textarea',
      label: adminLabel({ ca: 'Text de suport', en: 'Supporting text', es: 'Texto de apoyo' }),
      localized: true,
    },
    {
      name: 'image',
      type: 'upload',
      admin: {
        description: adminLabel({
          ca: 'Opcional. Es mostra a tota l’amplada, sota la frase.',
          en: 'Optional. Shown full-width, below the statement.',
          es: 'Opcional. Se muestra a lo ancho, debajo de la frase.',
        }),
      },
      label: adminLabel({ ca: 'Imatge', en: 'Image', es: 'Imagen' }),
      relationTo: 'media',
    },
    {
      name: 'variant',
      type: 'select',
      defaultValue: 'default',
      label: adminLabel({ ca: 'Estil', en: 'Style', es: 'Estilo' }),
      options: [
        { label: adminLabel({ ca: 'Frase', en: 'Statement', es: 'Frase' }), value: 'default' },
        { label: adminLabel({ ca: 'Cita', en: 'Quote', es: 'Cita' }), value: 'quote' },
      ],
      required: true,
    },
  ],
}
