import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// Interns del paquet, pel camí de font del workspace (regla de les proves de la demo, Task 16; D56)
import { locales } from '../../../../packages/core/src/i18n/config.js'
import { seedMediaFiles as uploadMedia } from '../../../../packages/core/src/seed/media.js'
import { defaultLocaleOf } from '../../../../packages/core/src/site/index.js'
import { media, mediaKeys } from '../../src/site/seed/media'
import { siteConfig } from '../../src/site/site.config'

// A la demo, les imatges són el manifest `media` (fitxer i alt per clau) i les puja el motor del seed del paquet:
// el fitxer en l'idioma per defecte del client i l'alt de cada altre idioma per `update`.
const seedMedia = media.items
const defaultLocale = defaultLocaleOf(siteConfig)
const seedMediaFiles = (payload: unknown) =>
  uploadMedia(payload as never, media, { defaultLocale, translations: locales.filter((l) => l !== defaultLocale) })

describe('imágenes del seed', () => {
  it.each(mediaKeys)('%s tiene archivo y textos alternativos', (key) => {
    const item = seedMedia[key]
    expect(existsSync(path.resolve(media.dir, item.file))).toBe(true)
    for (const locale of locales) {
      expect(item.alt[locale]?.length, `falta alt en ${locale}`).toBeGreaterThan(10)
    }
  })

  // A la demo, la foto de cada escena del hero surt del manifest de la llavor (`scripts/hero-photos.ts`), no de
  // `public/site/hero/beat-N.webp`: la primera escena és `heroWorkshop`.
  it.each([1])('la escena %s del hero existe', (index) => {
    const beats = ['heroWorkshop', 'heroKitchen', 'heroBath', 'heroDone'] as const
    expect(existsSync(path.resolve(media.dir, media.items[beats[index - 1]].file))).toBe(true)
  })
})

describe('contexto de las llamadas de seedMediaFiles', () => {
  // El complemento de almacenamiento S3 guarda el primer fichero en
  // `req.context` y lo reutiliza en las llamadas siguientes que comparten ese
  // mismo objeto: con un `context` compartido las imágenes posteriores se
  // suben con los bytes de la primera. Medido en el VPS el 2026-09-23 (T9).
  const runWithFake = async () => {
    const contexts: unknown[] = []
    const record = (options: { context?: unknown }) => {
      contexts.push(options.context)
    }
    let next = 0
    const create = vi.fn(async (options: { context?: unknown }) => {
      record(options)
      next += 1
      return { id: next }
    })
    const update = vi.fn(async (options: { context?: unknown }) => {
      record(options)
      return { id: next }
    })
    const ids = await seedMediaFiles({ create, update } as never)
    return { contexts, create, ids, update }
  }

  it('cada llamada al API local recibe un objeto context distinto', async () => {
    const { contexts } = await runWithFake()
    expect(contexts.length).toBe(mediaKeys.length * locales.length)
    expect(new Set(contexts).size).toBe(contexts.length)
  })

  it('todas las llamadas desactivan la revalidación y devuelven los ids', async () => {
    const { contexts, create, ids, update } = await runWithFake()
    expect(create).toHaveBeenCalledTimes(mediaKeys.length)
    expect(update).toHaveBeenCalledTimes(mediaKeys.length * (locales.length - 1))
    for (const context of contexts) {
      expect(context).toEqual({ disableRevalidate: true })
    }
    expect(Object.keys(ids).sort()).toEqual([...mediaKeys].sort())
  })
})
