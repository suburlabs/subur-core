import { describe, expect, it, vi } from 'vitest'

import { ensureSuperAdmin } from '../../src/utilities/ensureSuperAdmin.js'

const fakePayload = ({ existing = [] as { id: number }[], superAdmins = 0 } = {}) => ({
  count: vi.fn().mockResolvedValue({ totalDocs: superAdmins }),
  create: vi.fn().mockResolvedValue({ id: 1 }),
  find: vi.fn().mockResolvedValue({ docs: existing }),
  logger: { info: vi.fn(), warn: vi.fn() },
  update: vi.fn().mockResolvedValue({ id: 1 }),
})

const env = { SUBUR_ADMIN_EMAIL: 'admin@subur.dev', SUBUR_ADMIN_PASSWORD: 'una-clave-larga' }

describe('ensureSuperAdmin', () => {
  it('no hace nada si ya existe un superadministrador', async () => {
    const payload = fakePayload({ superAdmins: 1 })
    expect(await ensureSuperAdmin(payload as never, env)).toBe('exists')
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('lo crea desde las variables de entorno', async () => {
    const payload = fakePayload()
    expect(await ensureSuperAdmin(payload as never, env)).toBe('created')
    expect(payload.create).toHaveBeenCalledWith({
      collection: 'users',
      data: {
        email: 'admin@subur.dev',
        name: 'Subur',
        password: 'una-clave-larga',
        role: 'superadmin',
      },
    })
  })

  it('asciende al usuario si el email ya existe, sin tocar su contraseña', async () => {
    const payload = fakePayload({ existing: [{ id: 7 }] })
    expect(await ensureSuperAdmin(payload as never, env)).toBe('promoted')
    expect(payload.update).toHaveBeenCalledWith({
      collection: 'users',
      data: { role: 'superadmin' },
      id: 7,
    })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('sin variables, avisa fuera del servidor real', async () => {
    const payload = fakePayload()
    expect(await ensureSuperAdmin(payload as never, {})).toBe('skipped')
    expect(payload.logger.warn).toHaveBeenCalled()
  })

  // Lanzar no detiene el servidor: el motor sirve igualmente a partir de la segunda
  // petición, sin volver a ejecutar `onInit`. Lo que deja el contenedor enfermo es
  // `/api/health`, que vuelve a llamar a esta función (véase `health.int.spec.ts`).
  it('sin variables, la función lanza en el servidor real', async () => {
    await expect(
      ensureSuperAdmin(fakePayload() as never, { SUBUR_RUN_MIGRATIONS: '1' }),
    ).rejects.toThrow(/SUBUR_ADMIN_EMAIL/)
  })

  it('con contraseña en blanco, avisa fuera del servidor real', async () => {
    const payload = fakePayload()
    const blank = { ...env, SUBUR_ADMIN_PASSWORD: '   ' }
    expect(await ensureSuperAdmin(payload as never, blank)).toBe('skipped')
    expect(payload.logger.warn).toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('con contraseña en blanco, la función lanza en el servidor real', async () => {
    const blank = { ...env, SUBUR_ADMIN_PASSWORD: '   ', SUBUR_RUN_MIGRATIONS: '1' }
    await expect(ensureSuperAdmin(fakePayload() as never, blank)).rejects.toThrow(
      /SUBUR_ADMIN_PASSWORD/,
    )
  })

  it('no recorta espacios de una contraseña real', async () => {
    const payload = fakePayload()
    const withSpaces = { ...env, SUBUR_ADMIN_PASSWORD: ' clave con espacios ' }
    expect(await ensureSuperAdmin(payload as never, withSpaces)).toBe('created')
    expect(payload.create).toHaveBeenCalledWith({
      collection: 'users',
      data: {
        email: 'admin@subur.dev',
        name: 'Subur',
        password: ' clave con espacios ',
        role: 'superadmin',
      },
    })
  })

  it('normaliza el email del entorno a minúsculas para buscarlo y crearlo', async () => {
    const payload = fakePayload()
    const upperCaseEmail = { ...env, SUBUR_ADMIN_EMAIL: 'Admin@Subur.dev' }
    expect(await ensureSuperAdmin(payload as never, upperCaseEmail)).toBe('created')
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: { equals: 'admin@subur.dev' } } }),
    )
    expect(payload.create).toHaveBeenCalledWith({
      collection: 'users',
      data: {
        email: 'admin@subur.dev',
        name: 'Subur',
        password: 'una-clave-larga',
        role: 'superadmin',
      },
    })
  })
})
