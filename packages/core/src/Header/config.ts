import type { GlobalConfig } from 'payload'

import { link } from '../fields/link.js'
import { invalidateGlobalAfterChange } from '../hooks/invalidateSiteCache.js'
import { adminLabel } from '../i18n/adminLabel.js'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
  },
  label: adminLabel({ ca: 'Capçalera', en: 'Header', es: 'Cabecera' }),
  fields: [
    {
      name: 'navItems',
      type: 'array',
      admin: {
        components: { RowLabel: '@suburlabs/core/admin#HeaderRowLabel' },
        initCollapsed: true,
      },
      fields: [link({ appearances: false })],
      label: adminLabel({ ca: 'Enllaços del menú', en: 'Menu links', es: 'Enlaces del menú' }),
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
