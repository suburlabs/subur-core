import type { SelectField } from 'payload'

import { adminLabel } from '../i18n/adminLabel.js'

export const iconNames = [
  'sparkles',
  'clipboard-check',
  'search-check',
  'package-search',
  'shirt',
  'house',
  'key-round',
  'sprout',
  'car',
  'wrench',
  'sofa',
  'droplets',
  'door-open',
  'plug',
  'blinds',
  'trees',
  'shield-check',
  'phone',
  'mail',
  'clock',
] as const

export type IconName = (typeof iconNames)[number]

// Les etiquetes de les opcions es tradueixen pel que representen, no pel nom
// tècnic de la icona (p. ex. «Llave» / «Clau» / «Key» per a `key-round`).
const iconOptionLabels: Record<IconName, { ca: string; en: string; es: string }> = {
  blinds: { ca: 'Persianes', en: 'Blinds', es: 'Persianas' },
  car: { ca: 'Cotxe', en: 'Car', es: 'Coche' },
  'clipboard-check': { ca: 'Inspecció', en: 'Inspection', es: 'Inspección' },
  clock: { ca: 'Horari', en: 'Schedule', es: 'Horario' },
  'door-open': { ca: 'Entrada', en: 'Entrance', es: 'Entrada' },
  droplets: { ca: 'Aigua', en: 'Water', es: 'Agua' },
  house: { ca: 'Habitatge', en: 'Housing', es: 'Vivienda' },
  'key-round': { ca: 'Clau', en: 'Key', es: 'Llave' },
  mail: { ca: 'Correu', en: 'Mail', es: 'Correo' },
  'package-search': { ca: 'Inventari', en: 'Inventory', es: 'Inventario' },
  phone: { ca: 'Telèfon', en: 'Phone', es: 'Teléfono' },
  plug: { ca: 'Electricitat', en: 'Electricity', es: 'Electricidad' },
  'search-check': { ca: 'Revisió', en: 'Review', es: 'Revisión' },
  'shield-check': { ca: 'Seguretat', en: 'Security', es: 'Seguridad' },
  shirt: { ca: 'Roba', en: 'Clothing', es: 'Ropa' },
  sofa: { ca: 'Mobiliari', en: 'Furniture', es: 'Mobiliario' },
  sparkles: { ca: 'Neteja', en: 'Cleaning', es: 'Limpieza' },
  sprout: { ca: 'Jardí', en: 'Garden', es: 'Jardín' },
  trees: { ca: 'Exterior', en: 'Outdoor', es: 'Exterior' },
  wrench: { ca: 'Manteniment', en: 'Maintenance', es: 'Mantenimiento' },
}

export const iconField = (overrides: Partial<SelectField> = {}): SelectField =>
  ({
    name: 'icon',
    type: 'select',
    label: adminLabel({ ca: 'Icona', en: 'Icon', es: 'Icono' }),
    options: iconNames.map((value) => ({ label: adminLabel(iconOptionLabels[value]), value })),
    ...overrides,
  }) as SelectField
