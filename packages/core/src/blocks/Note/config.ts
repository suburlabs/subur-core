import type { Block } from 'payload'

import { iconField } from '../../fields/icon.js'
import { adminLabel } from '../../i18n/adminLabel.js'

export const noteBlock: Block = {
  slug: 'note',
  interfaceName: 'NoteBlock',
  // El nom del bloc l'aprova el propietari del producte: es tradueix, no es
  // renombra (esmena de revisió de la Tasca 8, ronda 1).
  labels: {
    plural: adminLabel({ ca: 'Avisos', en: 'Notices', es: 'Avisos' }),
    singular: adminLabel({ ca: 'Avís', en: 'Notice', es: 'Aviso' }),
  },
  imageURL: '/_subur/blocks/note.webp',
  imageAltText: 'Aviso destacado en placa',
  fields: [
    iconField(),
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
  ],
}
