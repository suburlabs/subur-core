'use client'

import { type RowLabelProps, useRowLabel, useTranslation } from '@payloadcms/ui'

import { type AdminLabel, adminLabel } from '../i18n/adminLabel.js'
import type { Header } from '../types/subur-types.js'

// Etiqueta de reserva quan la fila encara no té text: `es` és la reserva si
// l'idioma d'admin no és cap dels tres del catàleg.
const FALLBACK_LABEL: AdminLabel = adminLabel({ ca: 'Enllaç', en: 'Link', es: 'Enlace' })

export const RowLabel: React.FC<RowLabelProps> = () => {
  const data = useRowLabel<NonNullable<Header['navItems']>[number]>()
  const { i18n } = useTranslation()
  const position = data.rowNumber !== undefined ? data.rowNumber + 1 : ''
  const fallback =
    i18n.language in FALLBACK_LABEL
      ? FALLBACK_LABEL[i18n.language as keyof AdminLabel]
      : FALLBACK_LABEL.es

  return <div>{data?.data?.link?.label ? `${position}. ${data.data.link.label}` : fallback}</div>
}
