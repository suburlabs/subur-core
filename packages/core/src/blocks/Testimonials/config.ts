import type { Block } from 'payload'

import { adminLabel } from '../../i18n/adminLabel.js'

export const testimonialsBlock: Block = {
  slug: 'testimonials',
  interfaceName: 'TestimonialsBlock',
  labels: {
    plural: adminLabel({ ca: 'Opinions de clients', en: 'Client reviews', es: 'Opiniones de clientes' }),
    singular: adminLabel({ ca: 'Opinions de clients', en: 'Client reviews', es: 'Opiniones de clientes' }),
  },
  imageURL: '/_subur/blocks/testimonials.webp',
  imageAltText: 'Opiniones de clientes en rótulos de cerámica',
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: adminLabel({ ca: 'Títol', en: 'Title', es: 'Título' }),
      localized: true,
    },
    {
      name: 'items',
      type: 'array',
      admin: {
        description: adminLabel({
          ca: 'Publiqui només opinions reals i amb permís de qui les signa. No n’inventi cap.',
          en: 'Publish only real reviews, with permission from whoever signed them. Never make one up.',
          es: 'Publique solo opiniones reales y con permiso de quien las firma. No invente ninguna.',
        }),
      },
      fields: [
        {
          name: 'quote',
          type: 'textarea',
          admin: {
            description: adminLabel({
              ca: 'El text tal com el va escriure la persona.',
              en: 'The text exactly as the person wrote it.',
              es: 'El texto tal como lo escribió la persona.',
            }),
          },
          label: adminLabel({ ca: 'Opinió', en: 'Review', es: 'Opinión' }),
          localized: true,
          required: true,
        },
        {
          name: 'author',
          type: 'text',
          admin: {
            description: adminLabel({
              ca: 'Nom tal com la persona n’ha autoritzat la publicació.',
              en: 'Name exactly as the person authorised it to be published.',
              es: 'Nombre tal como la persona ha autorizado publicarlo.',
            }),
          },
          label: adminLabel({ ca: 'Signatura', en: 'Signature', es: 'Firma' }),
          required: true,
        },
        {
          name: 'detail',
          type: 'text',
          admin: {
            description: adminLabel({
              ca: 'Opcional: població o tipus de propietat.',
              en: 'Optional: town or property type.',
              es: 'Opcional: población o tipo de propiedad.',
            }),
          },
          label: adminLabel({ ca: 'Detall', en: 'Detail', es: 'Detalle' }),
          localized: true,
        },
      ],
      label: adminLabel({ ca: 'Opinions', en: 'Reviews', es: 'Opiniones' }),
      labels: {
        plural: adminLabel({ ca: 'Opinions', en: 'Reviews', es: 'Opiniones' }),
        singular: adminLabel({ ca: 'Opinió', en: 'Review', es: 'Opinión' }),
      },
      minRows: 1,
      required: true,
    },
  ],
}
