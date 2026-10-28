'use client'

import { ConsentDialogLink } from '@c15t/nextjs/components/consent-dialog-link'

import { footerLink } from '../../Footer/footerLink.js'

// Disparador permanent per reobrir el diàleg de preferències de cookies des
// del peu. `ConsentDialogLink` (node_modules/@c15t/nextjs/docs/frameworks/next/components/consent-dialog-link.md)
// renderitza un `<button>` real i accessible amb teclat, sense estil propi
// per defecte (`noStyle` per defecte és `true`): pren directament l'aspecte
// dels altres enllaços del peu. El peu és un component de servidor (no pot
// fer servir els hooks de client de c15t), per això aquest disparador viu
// en el seu propi component de client, igual que `ThemeToggle`.
export function CookiePreferencesTrigger({ label }: { label: string }) {
  return <ConsentDialogLink className={footerLink}>{label}</ConsentDialogLink>
}
