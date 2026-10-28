import type { Block } from 'payload'

import { adminLabel } from '../../i18n/adminLabel.js'

export const ctaBandBlock: Block = {
  slug: 'ctaBand',
  interfaceName: 'CtaBandBlock',
  // El nom del bloc l'aprova el propietari del producte: es tradueix, no es
  // renombra (esmena de revisió de la Tasca 8, ronda 1).
  labels: {
    plural: adminLabel({ ca: 'Crides a l’acció', en: 'Calls to action', es: 'Llamadas a la acción' }),
    singular: adminLabel({ ca: 'Crida a l’acció', en: 'Call to action', es: 'Llamada a la acción' }),
  },
  imageURL: '/_subur/blocks/ctaBand.webp',
  imageAltText: 'Banda de contacto con teléfono',
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: {
        description: adminLabel({
          ca: 'Els botons de trucada i correu electrònic utilitzen les dades d’«Ajustos del web».',
          en: 'The call and email buttons use the data from "Site settings".',
          es: 'Los botones de llamada y email usan los datos de «Ajustes de la web».',
        }),
      },
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
  ],
}
