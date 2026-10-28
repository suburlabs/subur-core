import type { CollectionConfig } from 'payload'

import path from 'node:path'

import { anyone } from '../access/anyone.js'
import { authenticated } from '../access/authenticated.js'
import { invalidateAfterChange, invalidateAfterDelete } from '../hooks/invalidateSiteCache.js'
import { adminLabel } from '../i18n/adminLabel.js'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  folders: true,
  // Canviar l'`alt` o quina imatge es mostra canvia l'HTML de les pàgines que la fan servir.
  hooks: {
    afterChange: [invalidateAfterChange],
    afterDelete: [invalidateAfterDelete],
  },
  labels: {
    plural: adminLabel({ ca: 'Fitxers', en: 'Files', es: 'Archivos' }),
    singular: adminLabel({ ca: 'Fitxer', en: 'File', es: 'Archivo' }),
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      admin: {
        description: adminLabel({
          ca: 'Descrigui la imatge per a les persones que no la poden veure.',
          en: 'Describe the image for people who cannot see it.',
          es: 'Describa la imagen para las personas que no pueden verla.',
        }),
      },
      label: adminLabel({ ca: 'Text alternatiu', en: 'Alternative text', es: 'Texto alternativo' }),
      localized: true,
      required: true,
    },
    {
      name: 'caption',
      type: 'textarea',
      label: adminLabel({ ca: 'Peu de foto', en: 'Caption', es: 'Pie de foto' }),
      localized: true,
    },
  ],
  upload: {
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    imageSizes: [
      { name: 'thumbnail', width: 300 },
      { name: 'square', height: 500, width: 500 },
      { name: 'small', width: 600 },
      { name: 'medium', width: 900 },
      { name: 'large', width: 1400 },
      { name: 'xlarge', width: 1920 },
      { name: 'og', crop: 'center', height: 630, width: 1200 },
    ],
    // Llista explícita, sense SVG ni HTML: el que es puja es serveix públicament
    // des d'aquest mateix origen i, obert directament, hi executaria scripts.
    mimeTypes: ['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'],
    // Relatiu al procés del client, no al paquet (spec §3.4): a la imatge és `/app/public/media`, com abans.
    staticDir: process.env.MEDIA_DIR || path.resolve(process.cwd(), 'public/media'),
  },
}
