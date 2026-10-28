import path from 'node:path'

import type { BasePayload } from 'payload'

import type { Locale } from '../i18n/config.js'

import type { SeedMedia } from './types.js'

/**
 * Un objecte `context` NOU per a cada crida a l'API local: mai compartit.
 *
 * Mesurat al VPS el 2026-09-23 (tasca 9) amb R2 actiu: amb un sol objecte
 * `context` per a totes les crides es creaven els 11 documents de `media`
 * però només la primera imatge arribava al bucket, sense cap error al log.
 * El complement d'emmagatzematge S3 (3.89.0) desa el primer fitxer dins
 * l'objecte `context` i no el torna a escriure mai més
 * (`hooks/preserveFileData.js`: `if (req.file && !req.context?._…)`), i a
 * l'hora de pujar fa `file = req.file ?? ctx.file`
 * (`utilities/getIncomingFiles.js`). Com que `req.context` és exactament
 * l'objecte que li dona l'API local, l'`update` de l'`alt` traduït —que no
 * porta cap fitxer— hi retroba el fitxer de la PRIMERA imatge i el complement
 * torna a entrar al camí de pujada amb els bytes equivocats. Amb un objecte
 * per crida, cada pujada veu només el seu fitxer.
 */
const freshContext = () => ({ disableRevalidate: true })

/**
 * Puja cada imatge de `media.dir`: crea el document en l'idioma per defecte
 * del client i n'escriu el text alternatiu a cada idioma de `translations`.
 * Torna l'identificador de cada clau.
 */
export async function seedMediaFiles<K extends string>(
  payload: BasePayload,
  media: SeedMedia<K>,
  { defaultLocale, translations }: { defaultLocale: Locale; translations: readonly Locale[] },
): Promise<Record<K, number>> {
  const ids = {} as Record<K, number>

  for (const key of Object.keys(media.items) as K[]) {
    const item = media.items[key]
    const doc = await payload.create({
      collection: 'media',
      context: freshContext(),
      data: { alt: item.alt[defaultLocale] },
      filePath: path.resolve(media.dir, item.file),
      locale: defaultLocale,
    })
    ids[key] = doc.id

    for (const locale of translations) {
      await payload.update({
        collection: 'media',
        context: freshContext(),
        data: { alt: item.alt[locale] },
        id: doc.id,
        locale,
      })
    }
  }

  return ids
}
