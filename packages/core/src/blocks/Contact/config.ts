import type { Block } from 'payload'

import { adminLabel } from '../../i18n/adminLabel.js'

export const contactBlock: Block = {
  slug: 'contact',
  interfaceName: 'ContactBlock',
  labels: {
    plural: adminLabel({ ca: 'Blocs de contacte', en: 'Contact blocks', es: 'Bloques de contacto' }),
    singular: adminLabel({ ca: 'Bloc de contacte', en: 'Contact block', es: 'Bloque de contacto' }),
  },
  imageURL: '/_subur/blocks/contact.webp',
  imageAltText: 'Datos de contacto y formulario',
  fields: [
    {
      name: 'heading',
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
    },
    {
      name: 'form',
      type: 'relationship',
      label: adminLabel({ ca: 'Formulari', en: 'Form', es: 'Formulario' }),
      relationTo: 'forms',
      required: true,
    },
  ],
}
