import type { Locale } from '../../i18n/config.js'

/**
 * El crèdit de la plataforma al peu (spec §0.5): els textos, en l'idioma del visitant, i l'enllaç són fixos al codi;
 * el que es contracta és si es pinta, `subscription.footerCredit`, no què diu.
 */
export const suburCredit: Record<Locale, { href: 'https://subur.dev'; text: string }> = {
  ca: { href: 'https://subur.dev', text: 'Web feta per Subur' },
  en: { href: 'https://subur.dev', text: 'Website by Subur' },
  es: { href: 'https://subur.dev', text: 'Web hecha por Subur' },
}
