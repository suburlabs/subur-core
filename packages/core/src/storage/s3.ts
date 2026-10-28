import { s3Storage as s3StoragePlugin } from '@payloadcms/storage-s3'
import type { Plugin } from 'payload'

import { shouldRunMigrations } from '../utilities/migrationsGate.js'

type Env = Record<string, string | undefined>

export type MediaStorage = 'local' | 's3'
export type S3Config = {
  accessKeyId: string
  bucket: string
  endpoint: string
  region: string
  secretAccessKey: string
}

export const S3_KEYS = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_ENDPOINT'] as const
export const MEDIA_STORAGE_MISSING =
  'MEDIA_STORAGE no está definida: s3 (bucket compatible con S3) o local (disco)'

const read = (env: Env, key: string): string => env[key]?.trim() ?? ''

/**
 * On van els fitxers pujats (spec §23.5). Una tria explícita en el servidor
 * real (`SUBUR_RUN_MIGRATIONS=1`, el mateix senyal que aplica migracions):
 * sense la variable, error amb el nom. En desenvolupament, disc local.
 */
export function mediaStorage(
  env: Env,
  production: boolean = shouldRunMigrations(env),
): MediaStorage {
  const value = read(env, 'MEDIA_STORAGE')
  if (value === '') {
    if (production) throw new Error(MEDIA_STORAGE_MISSING)
    return 'local'
  }
  if (value === 's3' || value === 'local') return value
  throw new Error('MEDIA_STORAGE no válida (valores admitidos: s3, local)')
}

/**
 * Amb `s3`, les quatre variables són obligatòries i l'endpoint és explícit
 * (R2, MinIO, AWS o qualsevol compatible): cap constructor d'URL per
 * proveïdor. Amb `local` (o sense `MEDIA_STORAGE` en desenvolupament), `null`.
 * L'error de configuració diu el nom de la variable, mai cap valor.
 */
export function s3Config(env: Env): null | S3Config {
  // `production: false`: aquí no es decideix si la variable és obligatòria
  // (això ho fa /api/health amb `mediaStorage`); només si S3 és actiu.
  if (mediaStorage(env, false) !== 's3') return null
  const missing = S3_KEYS.filter((key) => read(env, key) === '')
  if (missing.length > 0) throw new Error(`S3: faltan variables de entorno: ${missing.join(', ')}`)
  const endpoint = read(env, 'S3_ENDPOINT')
  if (!/^https?:\/\/[^\s/]+/.test(endpoint)) {
    throw new Error(
      'S3_ENDPOINT tiene que ser una URL http(s), p. ej. https://<cuenta>.eu.r2.cloudflarestorage.com',
    )
  }
  return {
    accessKeyId: read(env, 'S3_ACCESS_KEY_ID'),
    bucket: read(env, 'S3_BUCKET'),
    endpoint,
    region: read(env, 'S3_REGION') || 'auto',
    secretAccessKey: read(env, 'S3_SECRET_ACCESS_KEY'),
  }
}

export const isS3Active = (env: Env): boolean => s3Config(env) !== null

/**
 * El connector és sempre a la configuració, actiu o no. Sense S3 actiu no toca
 * res de la col·lecció: la torna tal com arriba, i les pujades van al disc
 * local (`MEDIA_DIR`, per defecte `public/media`). L'esquema de `media` és
 * idèntic en els dos modes (cap migració canvia amb `MEDIA_STORAGE`). En tots
 * dos modes registra un proveïdor d'administració (`initClientUploads`): per
 * això `importMap.js` ha de portar `S3ClientUploadHandler`, o `/admin` es
 * queda en blanc.
 *
 * Model A (spec §19.4): `disablePayloadAccessControl` no es toca, les URL
 * continuen sent `/api/media/file/<nom>` i `upload.mimeTypes` segueix manant.
 */
export const s3Storage = (env: Env = process.env): Plugin => {
  const s3 = s3Config(env)
  return s3StoragePlugin({
    bucket: s3?.bucket ?? '',
    collections: { media: true },
    config: {
      credentials: {
        accessKeyId: s3?.accessKeyId ?? '',
        secretAccessKey: s3?.secretAccessKey ?? '',
      },
      endpoint: s3?.endpoint ?? '',
      forcePathStyle: true,
      region: s3?.region ?? 'auto',
    },
    enabled: s3 !== null,
  })
}
