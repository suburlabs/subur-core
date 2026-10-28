import type { Page } from '@playwright/test'

/**
 * Tanca el bàner de consentiment de c15t, si hi és, amb un clic al botó real
 * «Accepta», mai sembrant `localStorage` o galetes a mà: així s'exercita el
 * camí real del codi (i el seu format real de desament).
 *
 * Cada context nou de Playwright és un perfil nou, i des de la Tasca 3 tot
 * perfil nou mostra el bàner en la primera pintada. Les proves que no tracten
 * del consentiment poden cridar aquest ajudant just després de `page.goto`
 * quan el bàner taparia un clic, o quan (com amb el full del menú mòbil) faria
 * que un `page.getByRole('dialog')` sense qualificar trobés dos elements alhora,
 * perquè la targeta del bàner de c15t també porta `role="dialog"`
 * (`aria-label="Galetes"` en català).
 *
 * El bàner parla l'idioma de la ruta: les proves que fan servir aquest ajudant
 * visiten pàgines de `/ca`.
 *
 * Només s'ha de cridar des de les proves que ho necessiten; la resta es deixa
 * tal com és perquè el comportament del perfil net es continuï exercitant en
 * altres llocs (vegeu `tests/e2e/consent.e2e.spec.ts`).
 */
export async function dismissConsent(page: Page): Promise<void> {
  const banner = page.getByRole('dialog', { name: 'Galetes' })
  // `isVisible()` no espera: just després de `goto` el bàner potser encara no
  // s'ha muntat (es pinta al client), així que cal una espera acotada abans de
  // decidir si hi ha res a tancar.
  const appeared = await banner
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false)
  if (appeared) {
    await banner.getByRole('button', { name: 'Accepta', exact: true }).click()
    await banner.waitFor({ state: 'hidden' })
  }
}
