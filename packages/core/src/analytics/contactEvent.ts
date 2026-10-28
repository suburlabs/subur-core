export type ContactEventName = 'contact-email' | 'contact-form' | 'contact-phone' | 'contact-whatsapp'

/**
 * Quin contacte és un enllaç, per l'`href` (spec §22.5). Només l'esquema o
 * l'amfitrió: mai el número ni el correu surten d'aquí.
 */
export function contactEventFor(href: string): ContactEventName | null {
  // Només l'esquema en minúscules (`TEL:`, `MAILTO:`… són vàlids als
  // navegadors): mai la resta de l'`href` (el número o el correu hi poden
  // portar majúscules legítimes que no s'han de normalitzar).
  const colonIndex = href.indexOf(':')
  const scheme = colonIndex === -1 ? '' : href.slice(0, colonIndex + 1).toLowerCase()
  if (scheme === 'tel:') return 'contact-phone'
  if (scheme === 'mailto:') return 'contact-email'
  if (scheme === 'whatsapp:') return 'contact-whatsapp'
  try {
    const { hostname } = new URL(href)
    if (hostname === 'wa.me' || hostname === 'api.whatsapp.com') return 'contact-whatsapp'
  } catch {
    // Relatiu o mal format: no és un contacte.
  }
  return null
}
