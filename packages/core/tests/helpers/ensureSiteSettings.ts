import type { Payload } from 'payload'

import type { SiteSettings } from '../../src/types/subur-types.js'

import { locales } from '../../src/i18n/config.js'

/** Cap prova no ha de disparar la revalidació de les rutes. */
const context = { disableRevalidate: true }

type RequiredContact = Pick<SiteSettings, 'address' | 'email' | 'hours' | 'phone'>

const filler: RequiredContact = {
  address: 'Test',
  email: 'test@subur.dev',
  hours: 'Test',
  phone: '000000000',
}

/**
 * El global `site-settings` té quatre camps obligatoris: `phone`, `email`,
 * `address` i `hours`. Sobre la base efímera de les proves (només migrada, mai
 * sembrada) cap d'ells té valor, i llavors qualsevol `updateGlobal` — encara
 * que només toqui un altre camp — falla perquè la validació és del document
 * sencer, per idioma.
 *
 * `phone` i `email` no són localitzats: un sol valor per a tot el document, de
 * manera que n'hi ha prou d'escriure'ls una vegada. `address` i `hours` sí que
 * ho són, i per tant en cal un per a cada idioma del catàleg.
 *
 * És idempotent: llegeix primer i només escriu els valors que falten, així que
 * sobre una base ja sembrada no toca res i no trepitja el contingut real.
 */
export const ensureSiteSettings = async (payload: Payload): Promise<void> => {
  for (const locale of locales) {
    const current = await payload.findGlobal({
      depth: 0,
      fallbackLocale: false,
      locale,
      select: { address: true, email: true, hours: true, phone: true },
      slug: 'site-settings',
    })

    const data: Partial<RequiredContact> = {}
    if (!current.address) data.address = filler.address
    if (!current.email) data.email = filler.email
    if (!current.hours) data.hours = filler.hours
    if (!current.phone) data.phone = filler.phone

    if (Object.keys(data).length === 0) continue

    // `fallbackLocale: false` com fa el panell (`?fallback-locale=null`):
    // aquesta escriptura és parcial per idioma i no ha d'arrossegar
    // `location.areaServed` del castellà, la `id` del qual és clau primària
    // compartida entre idiomes (una segona inserció hi xocaria, Postgres
    // 23505).
    await payload.updateGlobal({ context, data, fallbackLocale: false, locale, slug: 'site-settings' })
  }
}
