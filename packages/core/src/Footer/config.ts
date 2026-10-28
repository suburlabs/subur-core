import type { GlobalConfig } from 'payload'

import { link } from '../fields/link.js'
import { invalidateGlobalAfterChange } from '../hooks/invalidateSiteCache.js'
import { adminLabel } from '../i18n/adminLabel.js'

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
  },
  label: adminLabel({ ca: 'Peu de pàgina', en: 'Footer', es: 'Pie de página' }),
  fields: [
    {
      name: 'tagline',
      type: 'textarea',
      label: adminLabel({ ca: 'Frase de marca', en: 'Brand tagline', es: 'Frase de marca' }),
      localized: true,
    },
    {
      name: 'columns',
      type: 'array',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'title',
          type: 'text',
          label: adminLabel({ ca: 'Títol', en: 'Title', es: 'Título' }),
          localized: true,
          required: true,
        },
        {
          name: 'links',
          type: 'array',
          admin: { components: { RowLabel: '@suburlabs/core/admin#FooterRowLabel' } },
          fields: [link({ appearances: false })],
          label: adminLabel({ ca: 'Enllaços', en: 'Links', es: 'Enlaces' }),
          labels: {
            plural: adminLabel({ ca: 'Enllaços', en: 'Links', es: 'Enlaces' }),
            singular: adminLabel({ ca: 'Enllaç', en: 'Link', es: 'Enlace' }),
          },
        },
      ],
      label: adminLabel({ ca: 'Columnes d’enllaços', en: 'Link columns', es: 'Columnas de enlaces' }),
      labels: {
        plural: adminLabel({ ca: 'Columnes', en: 'Columns', es: 'Columnas' }),
        singular: adminLabel({ ca: 'Columna', en: 'Column', es: 'Columna' }),
      },
      maxRows: 4,
    },
    {
      name: 'legalLinks',
      type: 'array',
      admin: { components: { RowLabel: '@suburlabs/core/admin#FooterRowLabel' } },
      fields: [link({ appearances: false })],
      label: adminLabel({ ca: 'Enllaços legals', en: 'Legal links', es: 'Enlaces legales' }),
      labels: {
        plural: adminLabel({ ca: 'Enllaços', en: 'Links', es: 'Enlaces' }),
        singular: adminLabel({ ca: 'Enllaç', en: 'Link', es: 'Enlace' }),
      },
      maxRows: 6,
    },
  ],
  hooks: {
    afterChange: [invalidateGlobalAfterChange],
  },
}
