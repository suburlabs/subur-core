import {
  FixedToolbarFeature,
  HeadingFeature,
  lexicalEditor,
  OrderedListFeature,
  UnorderedListFeature,
} from '@payloadcms/richtext-lexical'
import type { Block } from 'payload'

import { adminLabel } from '../../i18n/adminLabel.js'

export const richTextSectionBlock: Block = {
  slug: 'richTextSection',
  interfaceName: 'RichTextSectionBlock',
  labels: {
    plural: adminLabel({ ca: 'Textos llargs', en: 'Long texts', es: 'Textos largos' }),
    singular: adminLabel({ ca: 'Text llarg', en: 'Long text', es: 'Texto largo' }),
  },
  imageURL: '/_subur/blocks/richTextSection.webp',
  imageAltText: 'Texto largo con títulos',
  fields: [
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => [
          ...rootFeatures,
          HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }),
          UnorderedListFeature(),
          OrderedListFeature(),
          FixedToolbarFeature(),
        ],
      }),
      label: adminLabel({ ca: 'Contingut', en: 'Content', es: 'Contenido' }),
      localized: true,
      required: true,
    },
  ],
}
