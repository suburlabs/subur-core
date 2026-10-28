import type { Block } from 'payload'

import { adminLabel } from '../../i18n/adminLabel.js'

export const pageHeroBlock: Block = {
  slug: 'pageHero',
  interfaceName: 'PageHeroBlock',
  labels: {
    plural: adminLabel({ ca: 'Capçaleres de pàgina', en: 'Page headers', es: 'Cabeceras de página' }),
    singular: adminLabel({ ca: 'Capçalera de pàgina', en: 'Page header', es: 'Cabecera de página' }),
  },
  imageURL: '/_subur/blocks/pageHero.webp',
  imageAltText: 'Cabecera de página con título y entradilla',
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: adminLabel({ ca: 'Títol', en: 'Title', es: 'Título' }),
      localized: true,
      required: true,
    },
    {
      name: 'lead',
      type: 'textarea',
      label: adminLabel({ ca: 'Entradeta', en: 'Lead', es: 'Entradilla' }),
      localized: true,
    },
    {
      name: 'image',
      type: 'upload',
      label: adminLabel({ ca: 'Imatge (opcional)', en: 'Image (optional)', es: 'Imagen (opcional)' }),
      relationTo: 'media',
    },
  ],
}
