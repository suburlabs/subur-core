import { describe, expect, it, vi } from 'vitest'

import { checkHealth, healthEndpoint } from '../../src/endpoints/health.js'

/**
 * `count` responde por colección: `pages` es el latido de la base de datos y
 * `users` es la cuenta de superadministradores que hace `ensureSuperAdmin`.
 */
const fakePayload = ({ dbFails = false, plan = 'starter', superAdmins = 1 } = {}) => ({
  count: vi.fn(async ({ collection }: { collection: string }) => {
    if (dbFails) throw new Error('sin base de datos')
    return { totalDocs: collection === 'users' ? superAdmins : 1 }
  }),
  create: vi.fn().mockResolvedValue({ id: 1 }),
  find: vi.fn().mockResolvedValue({ docs: [] }),
  findGlobal: vi.fn(async () => ({ plan })),
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  update: vi.fn().mockResolvedValue({ id: 1 }),
})

const realServer = {
  MEDIA_STORAGE: 's3',
  S3_ACCESS_KEY_ID: 'k',
  S3_BUCKET: 'b',
  S3_ENDPOINT: 'https://a.eu.r2.cloudflarestorage.com',
  S3_SECRET_ACCESS_KEY: 's',
  SUBUR_RUN_MIGRATIONS: '1',
}

describe('checkHealth', () => {
  // Un 200 con un error registrado sería un fallo silencioso: la sonda daría el
  // servicio por sano mientras el log acusa un problema. Cada caso que espera
  // 200 comprueba también que `logger.error` no se ha llamado.
  it('responde 200 cuando la base de datos contesta y hay superadministrador', async () => {
    const payload = fakePayload()
    const response = await checkHealth(payload as never, realServer)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ plan: 'starter', status: 'ok' })
    expect(payload.logger.error).not.toHaveBeenCalled()
  })

  it('exposa el pla business', async () => {
    const response = await checkHealth(fakePayload({ plan: 'business' }) as never, realServer)
    expect(await response.json()).toEqual({ plan: 'business', status: 'ok' })
  })

  it('un pla desconegut compta com a starter', async () => {
    const response = await checkHealth(fakePayload({ plan: 'qualsevol' }) as never, realServer)
    expect(await response.json()).toEqual({ plan: 'starter', status: 'ok' })
  })

  it('responde 503 cuando la base de datos falla', async () => {
    const response = await checkHealth(fakePayload({ dbFails: true }) as never, realServer)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: 'error' })
  })

  it('responde 503 en el servidor real sin superadministrador y sin variables', async () => {
    const payload = fakePayload({ superAdmins: 0 })
    const response = await checkHealth(payload as never, realServer)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: 'error' })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('crea el superadministrador que falta si el entorno lo trae', async () => {
    const payload = fakePayload({ superAdmins: 0 })
    const response = await checkHealth(payload as never, {
      ...realServer,
      SUBUR_ADMIN_EMAIL: 'admin@subur.dev',
      SUBUR_ADMIN_PASSWORD: 'una-clave-larga',
    })
    expect(response.status).toBe(200)
    expect(payload.create).toHaveBeenCalled()
    expect(payload.logger.error).not.toHaveBeenCalled()
  })

  it('fuera del servidor real, la falta de superadministrador no marca enfermo', async () => {
    const payload = fakePayload({ superAdmins: 0 })
    const response = await checkHealth(payload as never, {})
    expect(response.status).toBe(200)
    expect(payload.logger.error).not.toHaveBeenCalled()
  })

  it('responde 503 en el servidor real sin MEDIA_STORAGE y registra el motivo', async () => {
    const payload = fakePayload()
    const response = await checkHealth(payload as never, { SUBUR_RUN_MIGRATIONS: '1' })
    expect(response.status).toBe(503)
    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      expect.stringMatching(/Salud/),
    )
  })

  it('responde 200 en el servidor real con MEDIA_STORAGE=local', async () => {
    const payload = fakePayload()
    const response = await checkHealth(payload as never, { MEDIA_STORAGE: 'local', SUBUR_RUN_MIGRATIONS: '1' })
    expect(response.status).toBe(200)
    expect(payload.logger.error).not.toHaveBeenCalled()
  })

  it('responde 503 con s3 a medias y registra qué variable falta', async () => {
    const payload = fakePayload()
    const response = await checkHealth(payload as never, { ...realServer, S3_BUCKET: undefined })
    expect(response.status).toBe(503)
    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.objectContaining({ message: expect.stringMatching(/S3_BUCKET/) }) }),
      expect.stringMatching(/Salud/),
    )
  })

  it('fuera del servidor real, sin MEDIA_STORAGE sigue respondiendo 200', async () => {
    const payload = fakePayload()
    const response = await checkHealth(payload as never, {})
    expect(response.status).toBe(200)
    expect(payload.logger.error).not.toHaveBeenCalled()
  })
})

describe('healthEndpoint', () => {
  it('atiende el HEALTHCHECK del contenedor con el payload de la petición', async () => {
    const payload = fakePayload()
    const response = await healthEndpoint.handler({ payload } as never)
    expect(response.status).toBe(200)
    expect(payload.count).toHaveBeenCalledWith(expect.objectContaining({ collection: 'pages' }))
    expect(payload.logger.error).not.toHaveBeenCalled()
  })
})
