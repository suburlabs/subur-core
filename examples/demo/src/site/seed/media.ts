import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SeedMedia } from '@suburlabs/core/seed'

export const mediaKeys = ['heroWorkshop', 'heroKitchen', 'heroBath', 'heroDone', 'serviceKitchen', 'serviceBath', 'serviceRepairs', 'pageServices', 'pageContact'] as const
export type MediaKey = (typeof mediaKeys)[number]

const alt = (ca: string, es: string, en: string) => ({ ca, en, es })
export const media: SeedMedia<MediaKey> = {
  dir: path.join(path.dirname(fileURLToPath(import.meta.url)), 'media'),
  items: {
    heroBath: { alt: alt('Composició abstracta en tons verds', 'Composición abstracta en tonos verdes', 'Abstract composition in green tones'), file: 'hero-bath.webp' },
    heroDone: { alt: alt('Composició abstracta en tons clars', 'Composición abstracta en tonos claros', 'Abstract composition in light tones'), file: 'hero-done.webp' },
    heroKitchen: { alt: alt('Composició abstracta en tons càlids', 'Composición abstracta en tonos cálidos', 'Abstract composition in warm tones'), file: 'hero-kitchen.webp' },
    heroWorkshop: { alt: alt('Composició abstracta en tons foscos', 'Composición abstracta en tonos oscuros', 'Abstract composition in dark tones'), file: 'hero-workshop.webp' },
    pageContact: { alt: alt('Formes geomètriques sobre fons clar', 'Formas geométricas sobre fondo claro', 'Geometric shapes on a light background'), file: 'page-contact.webp' },
    pageServices: { alt: alt('Formes geomètriques sobre fons verd', 'Formas geométricas sobre fondo verde', 'Geometric shapes on a green background'), file: 'page-services.webp' },
    serviceBath: { alt: alt('Rectangle i cercle superposats en blau', 'Rectángulo y círculo superpuestos en azul', 'Overlapping rectangle and circle in blue'), file: 'service-bath.webp' },
    serviceKitchen: { alt: alt('Rectangle i cercle superposats en ocre', 'Rectángulo y círculo superpuestos en ocre', 'Overlapping rectangle and circle in ochre'), file: 'service-kitchen.webp' },
    serviceRepairs: { alt: alt('Rectangle i cercle superposats en gris', 'Rectángulo y círculo superpuestos en gris', 'Overlapping rectangle and circle in grey'), file: 'service-repairs.webp' },
  },
}
