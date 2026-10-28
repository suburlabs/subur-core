import type { Field, GroupField } from 'payload'

import { adminLabel, type AdminLabel } from '../i18n/adminLabel.js'
import deepMerge from '../utilities/deepMerge.js'

export type LinkAppearances = 'default' | 'outline'

export const appearanceOptions: Record<LinkAppearances, { label: AdminLabel; value: string }> = {
  default: { label: adminLabel({ ca: 'Principal', en: 'Primary', es: 'Principal' }), value: 'default' },
  outline: { label: adminLabel({ ca: 'Secundari', en: 'Secondary', es: 'Secundario' }), value: 'outline' },
}

type LinkType = (options?: {
  appearances?: LinkAppearances[] | false
  disableLabel?: boolean
  overrides?: Partial<GroupField>
}) => Field

export const link: LinkType = ({ appearances, disableLabel = false, overrides = {} } = {}) => {
  const linkResult: GroupField = {
    name: 'link',
    type: 'group',
    admin: { hideGutter: true },
    label: adminLabel({ ca: 'Enllaç', en: 'Link', es: 'Enlace' }),
    fields: [
      {
        type: 'row',
        fields: [
          {
            name: 'type',
            type: 'radio',
            admin: { layout: 'horizontal', width: '50%' },
            defaultValue: 'reference',
            label: adminLabel({ ca: 'Tipus', en: 'Type', es: 'Tipo' }),
            options: [
              {
                label: adminLabel({ ca: 'Pàgina del web', en: 'Website page', es: 'Página de la web' }),
                value: 'reference',
              },
              {
                label: adminLabel({
                  ca: 'URL (telèfon, correu electrònic o web externa)',
                  en: 'URL (phone, email or external website)',
                  es: 'URL (teléfono, email o web externa)',
                }),
                value: 'custom',
              },
            ],
          },
          {
            name: 'newTab',
            type: 'checkbox',
            admin: { style: { alignSelf: 'flex-end' }, width: '50%' },
            label: adminLabel({ ca: 'Obre en una pestanya nova', en: 'Open in a new tab', es: 'Abrir en una pestaña nueva' }),
          },
        ],
      },
    ],
  }

  const linkTypes: Field[] = [
    {
      name: 'reference',
      type: 'relationship',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'reference',
        width: '50%',
      },
      label: adminLabel({ ca: 'Pàgina', en: 'Page', es: 'Página' }),
      relationTo: ['pages'],
      required: true,
    },
    {
      name: 'url',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'custom',
        description: adminLabel({
          ca: 'Exemples: tel:+34600000000, mailto:hola@ejemplo.com, https://…',
          en: 'Examples: tel:+34600000000, mailto:hola@ejemplo.com, https://…',
          es: 'Ejemplos: tel:+34600000000, mailto:hola@ejemplo.com, https://…',
        }),
        width: '50%',
      },
      label: adminLabel({ ca: 'URL', en: 'URL', es: 'URL' }),
      required: true,
    },
  ]

  if (!disableLabel) {
    linkResult.fields.push({
      type: 'row',
      fields: [
        ...linkTypes,
        {
          name: 'label',
          type: 'text',
          admin: { width: '50%' },
          label: adminLabel({ ca: 'Text de l’enllaç', en: 'Link text', es: 'Texto del enlace' }),
          localized: true,
          required: true,
        },
      ],
    })
  } else {
    linkResult.fields.push(...linkTypes)
  }

  if (appearances !== false) {
    const appearanceOptionsToUse = appearances
      ? appearances.map((appearance) => appearanceOptions[appearance])
      : [appearanceOptions.default, appearanceOptions.outline]

    linkResult.fields.push({
      name: 'appearance',
      type: 'select',
      defaultValue: 'default',
      label: adminLabel({ ca: 'Estil', en: 'Style', es: 'Estilo' }),
      options: appearanceOptionsToUse,
    })
  }

  return deepMerge(linkResult, overrides)
}
