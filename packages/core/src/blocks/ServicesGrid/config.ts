import type { Block } from 'payload'

import { adminLabel } from '../../i18n/adminLabel.js'

export const servicesGridBlock: Block = {
  slug: 'servicesGrid',
  interfaceName: 'ServicesGridBlock',
  labels: {
    plural: adminLabel({ ca: 'Llistes de serveis', en: 'Service lists', es: 'Listas de servicios' }),
    singular: adminLabel({ ca: 'Llista de serveis', en: 'Service list', es: 'Lista de servicios' }),
  },
  imageURL: '/_subur/blocks/servicesGrid.webp',
  imageAltText: 'Servicios en ventanas con persiana',
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
          name: 'title',
          type: 'text',
          label: adminLabel({ ca: 'Servei', en: 'Service', es: 'Servicio' }),
          localized: true,
          required: true,
        },
        {
          name: 'tagline',
          type: 'text',
          label: adminLabel({ ca: 'Subtítol', en: 'Subtitle', es: 'Subtítulo' }),
          localized: true,
        },
        {
          name: 'summary',
          type: 'textarea',
          label: adminLabel({ ca: 'Resum', en: 'Summary', es: 'Resumen' }),
          localized: true,
        },
        {
          name: 'image',
          type: 'upload',
          admin: {
            description: adminLabel({
              ca: 'Si es deixa buida, la finestra es mostra només amb la persiana.',
              en: 'If left empty, the window is shown with just the shutter.',
              es: 'Si se deja vacía, la ventana se muestra solo con la persiana.',
            }),
          },
          label: adminLabel({ ca: 'Imatge', en: 'Image', es: 'Imagen' }),
          relationTo: 'media',
        },
        {
          name: 'page',
          type: 'relationship',
          admin: {
            description: adminLabel({
              ca: 'Si es deixa buit, no es mostra l’enllaç «Llegir més».',
              en: 'If left empty, the "Read more" link is not shown.',
              es: 'Si se deja vacío, no se muestra el enlace «Leer más».',
            }),
          },
          label: adminLabel({ ca: 'Pàgina del servei', en: 'Service page', es: 'Página del servicio' }),
          relationTo: 'pages',
        },
      ],
      label: adminLabel({ ca: 'Serveis', en: 'Services', es: 'Servicios' }),
      labels: {
        plural: adminLabel({ ca: 'Serveis', en: 'Services', es: 'Servicios' }),
        singular: adminLabel({ ca: 'Servei', en: 'Service', es: 'Servicio' }),
      },
      maxRows: 6,
      minRows: 1,
      required: true,
    },
  ],
}
