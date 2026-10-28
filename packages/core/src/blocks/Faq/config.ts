import type { Block } from 'payload'

import { adminLabel } from '../../i18n/adminLabel.js'

/**
 * Preguntes freqüents (spec §22.3). Del nucli i no opcional: l'esquema és el
 * mateix a totes les webs. La resposta és text pla a posta: el mateix text
 * serveix per a la pàgina i per al `FAQPage` del JSON-LD (només Business).
 */
export const faqBlock: Block = {
  slug: 'faq',
  interfaceName: 'FaqBlock',
  labels: {
    plural: adminLabel({ ca: 'Preguntes freqüents', en: 'FAQs', es: 'Preguntas frecuentes' }),
    singular: adminLabel({ ca: 'Preguntes freqüents', en: 'FAQ', es: 'Preguntas frecuentes' }),
  },
  imageURL: '/_subur/blocks/faq.webp',
  imageAltText: 'Preguntas frecuentes desplegables',
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
      name: 'items',
      type: 'array',
      fields: [
        {
          name: 'question',
          type: 'text',
          label: adminLabel({ ca: 'Pregunta', en: 'Question', es: 'Pregunta' }),
          localized: true,
          required: true,
        },
        {
          name: 'answer',
          type: 'textarea',
          admin: {
            description: adminLabel({
              ca: 'Text pla. Es mostra a la pàgina i Google el pot llegir tal qual.',
              en: 'Plain text. It is shown on the page and Google can read it as is.',
              es: 'Texto sin formato. Se muestra en la página y Google lo puede leer tal cual.',
            }),
          },
          label: adminLabel({ ca: 'Resposta', en: 'Answer', es: 'Respuesta' }),
          localized: true,
          required: true,
        },
      ],
      label: adminLabel({ ca: 'Preguntes', en: 'Questions', es: 'Preguntas' }),
      labels: {
        plural: adminLabel({ ca: 'Preguntes', en: 'Questions', es: 'Preguntas' }),
        singular: adminLabel({ ca: 'Pregunta', en: 'Question', es: 'Pregunta' }),
      },
      minRows: 1,
      required: true,
    },
  ],
}
