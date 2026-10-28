import config from '../fixtures/app/src/payload.config.js'
import { getPayload } from 'payload'
import { describe, expect, it } from 'vitest'

import { isS3Active, MEDIA_STORAGE_MISSING, mediaStorage, s3Config, s3Storage } from '../../src/storage/s3.js'

const full = {
  MEDIA_STORAGE: 's3',
  S3_ACCESS_KEY_ID: 'clave',
  S3_BUCKET: 'cliente-uploads',
  S3_ENDPOINT: 'https://cuenta.eu.r2.cloudflarestorage.com',
  S3_SECRET_ACCESS_KEY: 'secreto',
}
const production = { SUBUR_RUN_MIGRATIONS: '1' }

describe('mediaStorage', () => {
  it('en desarrollo, sin variable: disco local', () => {
    expect(mediaStorage({})).toBe('local')
  })
  it('en el servidor real, sin variable: falla y dice el nombre', () => {
    expect(() => mediaStorage(production)).toThrow(MEDIA_STORAGE_MISSING)
    expect(() => mediaStorage(production)).toThrow(/MEDIA_STORAGE/)
  })
  it('local explícito vale también en el servidor real', () => {
    expect(mediaStorage({ ...production, MEDIA_STORAGE: 'local' })).toBe('local')
  })
  it('un valor desconocido falla con el nombre de la variable', () => {
    expect(() => mediaStorage({ MEDIA_STORAGE: 'disk' })).toThrow(/MEDIA_STORAGE/)
  })
  it('un valor desconocido no se repite en el mensaje (podría ser un secreto pegado)', () => {
    let message = ''
    try {
      mediaStorage({ MEDIA_STORAGE: 'disk' })
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toMatch(/MEDIA_STORAGE/)
    expect(message).not.toContain('disk')
  })
  it('espacios alrededor no cuentan', () => {
    expect(mediaStorage({ ...full, MEDIA_STORAGE: ' s3 ' })).toBe('s3')
  })
})

describe('s3Config', () => {
  it('con local: desactivado aunque haya variables S3_*', () => {
    expect(s3Config({ ...full, MEDIA_STORAGE: 'local' })).toBeNull()
    expect(isS3Active({ ...full, MEDIA_STORAGE: 'local' })).toBe(false)
  })
  it('con s3 y las cuatro: activo, endpoint tal cual, región auto', () => {
    expect(s3Config(full)).toEqual({
      accessKeyId: 'clave',
      bucket: 'cliente-uploads',
      endpoint: 'https://cuenta.eu.r2.cloudflarestorage.com',
      region: 'auto',
      secretAccessKey: 'secreto',
    })
    expect(isS3Active(full)).toBe(true)
  })
  it('S3_REGION explícita se respeta', () => {
    expect(s3Config({ ...full, S3_REGION: 'eu-central-1' })?.region).toBe('eu-central-1')
  })
  it('con s3 y alguna de menos: falla y dice cuál falta', () => {
    const { S3_SECRET_ACCESS_KEY: _omitted, ...partial } = full
    expect(() => s3Config(partial)).toThrow(/S3_SECRET_ACCESS_KEY/)
  })
  it('un valor en blanco cuenta como ausente', () => {
    expect(() => s3Config({ ...full, S3_BUCKET: '  ' })).toThrow(/S3_BUCKET/)
  })
  it('el endpoint tiene que ser una URL http(s)', () => {
    expect(() => s3Config({ ...full, S3_ENDPOINT: 'cuenta.eu.r2.cloudflarestorage.com' })).toThrow(/S3_ENDPOINT/)
  })
  it('en desarrollo sin MEDIA_STORAGE, las S3_* solas no activan nada', () => {
    const { MEDIA_STORAGE: _m, ...vars } = full
    expect(s3Config(vars)).toBeNull()
  })
})

type StubCollection = {
  fields: { name?: string }[]
  slug: string
  upload?: { disableLocalStorage?: boolean }
}

/**
 * El connector és sempre a la configuració: aquests casos fixen què li fa a
 * `media` en cada mode, sense tocar la base de dades. L'stub porta el camp
 * `url` perquè una col·lecció de fitxers real ja en té columna.
 */
const mediaStub = () => ({
  collections: [
    {
      slug: 'media',
      fields: [
        { name: 'alt', type: 'text' },
        { name: 'url', type: 'text' },
      ],
      upload: {},
    },
  ],
})
const applyS3 = (env: Record<string, string | undefined>): StubCollection => {
  const result = s3Storage(env)(mediaStub() as never) as unknown as { collections: StubCollection[] }
  return result.collections.find((collection) => collection.slug === 'media')!
}

describe('s3Storage sobre la colección media', () => {
  it('con local no toca la colección', () => {
    const media = applyS3({})
    expect(media.upload?.disableLocalStorage).not.toBe(true)
    expect(media.fields.map((field) => field.name)).toEqual(['alt', 'url'])
  })
  it('con s3 desactiva el disco local', () => {
    expect(applyS3(full).upload?.disableLocalStorage).toBe(true)
  })
  it('el esquema de media es el mismo en los dos modos', () => {
    expect(applyS3({}).fields.map((f) => f.name)).toEqual(applyS3(full).fields.map((f) => f.name))
  })
})

/**
 * Contra un bucket real: només amb MEDIA_STORAGE=s3 i les S3_* a .env de qui
 * ho vulgui córrer. La condició de `skipIf` s'avalua en importar el fitxer, i
 * `s3Config` llança si les variables hi són a mitges: un llançament vol dir
 * «no disponible», i es diu pel log per no amagar una configuració incompleta.
 */
const s3Available = (): boolean => {
  try {
    return s3Config(process.env) !== null
  } catch (error) {
    console.warn(`S3 no disponible, se omiten las pruebas contra el bucket real: ${String(error)}`)
    return false
  }
}

describe.skipIf(!s3Available())('media sobre S3 (modelo A)', () => {
  it('rechaza un SVG aunque el adaptador esté activo', async () => {
    const payload = await getPayload({ config })
    // La mida surt del propi buffer: escrita a mà es desincronitza del
    // contingut a la primera vegada que algú el retoqui.
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')
    await expect(
      payload.create({
        collection: 'media',
        data: { alt: 'svg' },
        file: {
          data: svg,
          mimetype: 'image/svg+xml',
          name: 'g4-rechazado.svg',
          size: svg.byteLength,
        },
      }),
    ).rejects.toThrow()
  })

  it('un PNG sube y su URL sigue siendo del propio origen', async () => {
    const payload = await getPayload({ config })
    // PNG 1×1 vàlid
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    )
    const doc = await payload.create({
      collection: 'media',
      data: { alt: 'png' },
      file: { data: png, mimetype: 'image/png', name: 'g4-modelo-a.png', size: png.length },
    })
    expect(doc.url).toMatch(/^\/api\/media\/file\//)
    await payload.delete({ collection: 'media', id: doc.id })
  })
})
