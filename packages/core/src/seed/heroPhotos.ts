/**
 * Omple la foto de cada escena de la portada d'inici (el bloc `scrollHero` de
 * la pàgina `home`) amb la imatge que la llavor hi posa, només on el camp és
 * buit. És per a una base que ja té contingut i on el seed no pot tornar a
 * córrer perquè esborraria pàgines i imatges (runbook §8): producció, després
 * de desplegar la migració `hero_beat_photo`. Si el client ja hi ha triat una
 * foto, no la toca; tornar-la a executar no canvia res.
 *
 * `beatFiles` són els noms de fitxer de la llavor del client, un per escena i
 * en l'ordre de les escenes. El client en fa un script propi que la crida amb
 * el seu `payload` i el seu `siteConfig`.
 *
 * Cada imatge es busca a Mitjans pel nom de fitxer que li va donar la llavor.
 * Si no hi és (el client l'ha esborrada), aquella escena es queda buida i
 * el hero hi fa servir el fotograma de la pel·lícula.
 */
import path from 'node:path'

import type { BasePayload } from 'payload'

import { defaultLocaleOf, type SiteConfig } from '../site/index.js'

import { flushSiteCacheAfterSeed } from './index.js'

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function heroPhotos({
  beatFiles,
  payload,
  siteConfig,
}: {
  beatFiles: readonly string[]
  payload: BasePayload
  siteConfig: SiteConfig
}): Promise<void> {
  const defaultLocale = defaultLocaleOf(siteConfig)
  const { docs } = await payload.find({
    collection: 'pages',
    depth: 0,
    draft: false,
    limit: 1,
    locale: defaultLocale,
    where: { slug: { equals: 'home' } },
  })
  const home = docs[0]
  if (!home) throw new Error('Fotos del hero: no hi ha cap pàgina amb slug «home».')

  // Mitjans desa el fitxer amb el nom original o, si ja n'hi havia un d'igual al
  // mateix emmagatzematge, amb un sufix numèric (`hero-1-16.webp`, cas de la
  // base de desenvolupament després de sembrar moltes vegades). S'accepten
  // tots dos; entre diversos, guanya el nom exacte i després el més recent.
  const mediaIds: (number | null)[] = []
  for (const filename of beatFiles) {
    const extension = path.extname(filename)
    const stem = filename.slice(0, filename.length - extension.length)
    const sameFile = new RegExp(`^${escapeRegExp(stem)}(-\\d+)?${escapeRegExp(extension)}$`)
    const found = await payload.find({
      collection: 'media',
      depth: 0,
      limit: 50,
      sort: '-createdAt',
      where: { filename: { like: stem } },
    })
    const candidates = found.docs.filter((doc) => doc.filename && sameFile.test(doc.filename))
    const match = candidates.find((doc) => doc.filename === filename) ?? candidates[0]
    mediaIds.push(match?.id ?? null)
    if (!match) payload.logger.warn(`Fotos del hero: ${filename} no és a Mitjans; aquella escena es queda buida.`)
  }

  let filled = 0
  const layout = (home.layout ?? []).map((block) => {
    if (block.blockType !== 'scrollHero') return block
    return {
      ...block,
      beats: block.beats.map((beat, index) => {
        if (beat.image || !mediaIds[index]) return beat
        filled += 1
        return { ...beat, image: mediaIds[index] }
      }),
    }
  })

  if (filled === 0) {
    payload.logger.info('Fotos del hero: cap escena buida, res a fer.')
    return
  }

  // Mateixa forma que la llavor quan desa una traducció: el `layout` sencer tal
  // com s'ha llegit, amb els `id` de cada bloc i de cada escena, perquè els
  // textos dels altres idiomes (que viuen per idioma dins d'aquests mateixos
  // ids) es conservin.
  // `disableRevalidate`, com la llavor: el hook no escriu cap làpida. Per això,
  // en acabar, es buida la memòria cau a la base (làpida global '*'; runbook §8).
  await payload.update({
    collection: 'pages',
    context: { disableRevalidate: true },
    data: { _status: 'published', layout },
    id: home.id,
    locale: defaultLocale,
  })
  await flushSiteCacheAfterSeed(payload)
  payload.logger.info(`Fotos del hero: ${filled} escenes omplertes.`)
}
