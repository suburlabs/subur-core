import type { Block } from 'payload'

import { link } from '../../fields/link.js'
import { adminLabel } from '../../i18n/adminLabel.js'

export const scrollHeroBlock: Block = {
  slug: 'scrollHero',
  interfaceName: 'ScrollHeroBlock',
  labels: {
    plural: adminLabel({ ca: 'Portades d’inici', en: 'Home heroes', es: 'Portadas de inicio' }),
    singular: adminLabel({ ca: 'Portada d’inici', en: 'Home hero', es: 'Portada de inicio' }),
  },
  imageURL: '/_subur/blocks/scrollHero.webp',
  imageAltText: 'Portada de inicio con cuatro escenas y botones',
  fields: [
    {
      name: 'ariaLabel',
      type: 'text',
      admin: {
        description: adminLabel({
          ca: 'Descriu aquestes quatre seccions per a lectors de pantalla.',
          en: 'Describe these four sections for screen readers.',
          es: 'Describe estas cuatro secciones para lectores de pantalla.',
        }),
      },
      label: adminLabel({ ca: 'Descripció accessible', en: 'Accessible description', es: 'Descripción accesible' }),
      localized: true,
      required: true,
    },
    {
      name: 'beats',
      type: 'array',
      admin: {
        description: adminLabel({
          ca: 'Textos de les 4 seccions de la portada, en ordre.',
          en: 'Text for the 4 sections of the hero, in order.',
          es: 'Textos de las 4 secciones de la portada, en orden.',
        }),
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          admin: {
            description: adminLabel({
              ca: 'Nom curt de l’escena (2–5 paraules). Apareix a l’indicador de progrés.',
              en: 'Short name for the scene (2–5 words). Appears in the progress indicator.',
              es: 'Nombre corto de la escena (2–5 palabras). Aparece en el indicador de progreso.',
            }),
          },
          label: adminLabel({ ca: 'Nom de l’escena', en: 'Scene name', es: 'Nombre de la escena' }),
          localized: true,
          required: true,
        },
        {
          name: 'heading',
          type: 'text',
          label: adminLabel({ ca: 'Títol', en: 'Title', es: 'Título' }),
          localized: true,
          required: true,
        },
        {
          name: 'body',
          type: 'textarea',
          label: adminLabel({ ca: 'Text', en: 'Text', es: 'Texto' }),
          localized: true,
        },
        {
          name: 'image',
          type: 'upload',
          admin: {
            description: adminLabel({
              ca: 'Es veu a tota pantalla mentre es carrega la pel·lícula i sempre que no es pugui reproduir (moviment reduït, mode de baix consum). Millor una foto horitzontal relacionada amb el títol. Si es deixa buida, es fa servir un fotograma de la pel·lícula.',
              en: 'Shown full screen while the film loads and whenever it cannot play (reduced motion, low power mode). A landscape photo related to the title works best. If left empty, a frame of the film is used.',
              es: 'Se ve a pantalla completa mientras se carga la película y siempre que no se pueda reproducir (movimiento reducido, modo de bajo consumo). Mejor una foto horizontal relacionada con el título. Si se deja vacía, se usa un fotograma de la película.',
            }),
          },
          label: adminLabel({ ca: 'Foto', en: 'Photo', es: 'Foto' }),
          relationTo: 'media',
        },
      ],
      label: adminLabel({ ca: 'Escenes', en: 'Scenes', es: 'Escenas' }),
      labels: {
        plural: adminLabel({ ca: 'Escenes', en: 'Scenes', es: 'Escenas' }),
        singular: adminLabel({ ca: 'Escena', en: 'Scene', es: 'Escena' }),
      },
      maxRows: 4,
      minRows: 4,
      required: true,
    },
    link({
      appearances: false,
      overrides: {
        label: adminLabel({ ca: 'Botó principal', en: 'Primary button', es: 'Botón principal' }),
        name: 'primaryCta',
      },
    }),
    link({
      appearances: false,
      overrides: {
        label: adminLabel({ ca: 'Botó secundari', en: 'Secondary button', es: 'Botón secundario' }),
        name: 'secondaryCta',
      },
    }),
  ],
}
