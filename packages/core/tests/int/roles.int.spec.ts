import config from '../fixtures/app/src/payload.config.js'
import { Forbidden, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isSuperAdmin, isSuperAdminOrSelf, isSuperAdminUser } from '../../src/access/roles.js'

const args = (user: unknown) => ({ req: { user } }) as never

describe('funciones de acceso por rol', () => {
  it('reconoce al superadministrador', () => {
    expect(isSuperAdminUser({ role: 'superadmin' })).toBe(true)
    expect(isSuperAdminUser({ role: 'admin' })).toBe(false)
    expect(isSuperAdminUser(null)).toBe(false)
  })

  it('isSuperAdmin solo deja pasar al superadministrador', () => {
    expect(isSuperAdmin(args({ id: 1, role: 'superadmin' }))).toBe(true)
    expect(isSuperAdmin(args({ id: 2, role: 'admin' }))).toBe(false)
    expect(isSuperAdmin(args(null))).toBe(false)
  })

  it('isSuperAdminOrSelf limita al administrador a su propio documento', () => {
    expect(isSuperAdminOrSelf(args({ id: 1, role: 'superadmin' }))).toBe(true)
    expect(isSuperAdminOrSelf(args({ id: 2, role: 'admin' }))).toEqual({ id: { equals: 2 } })
    expect(isSuperAdminOrSelf(args(null))).toBe(false)
  })
})

describe('colección de usuarios', () => {
  let payload: Payload
  const emails = ['f1-super-a@subur.dev', 'f1-super-b@subur.dev', 'f1-client@subur.dev']
  const ids: Record<string, number> = {}

  beforeAll(async () => {
    payload = await getPayload({ config })
    await payload.delete({ collection: 'users', where: { email: { in: emails } } })
    for (const [email, role] of [
      [emails[0], 'superadmin'],
      [emails[1], 'superadmin'],
      [emails[2], 'admin'],
    ] as const) {
      const user = await payload.create({
        collection: 'users',
        data: { email, name: email, password: 'test-password', role },
      })
      ids[email] = user.id
    }
  })

  afterAll(async () => {
    await payload.delete({ collection: 'users', where: { email: { in: emails } } })
  })

  it('asigna el rol admin por defecto', async () => {
    const user = await payload.create({
      collection: 'users',
      // `role` s'omet expressament per provar el `defaultValue`: el tipus de `create` exigeix
      // igualment el camp perquè és `required`, encara que tingui valor per defecte.
      data: { email: 'f1-default@subur.dev', name: 'Default', password: 'test-password' } as never,
    })
    expect(user.role).toBe('admin')
    await payload.delete({ collection: 'users', id: user.id })
  })

  it('el administrador solo se lee a sí mismo', async () => {
    const client = await payload.findByID({ collection: 'users', id: ids[emails[2]] })
    const result = await payload.find({
      collection: 'users',
      overrideAccess: false,
      user: { ...client, collection: 'users' },
    })
    expect(result.docs.map((doc) => doc.email)).toEqual([emails[2]])
  })

  it('el administrador no puede crear usuarios ni cambiar su rol', async () => {
    const client = await payload.findByID({ collection: 'users', id: ids[emails[2]] })
    const user = { ...client, collection: 'users' as const }

    await expect(
      payload.create({
        collection: 'users',
        data: { email: 'f1-intruder@subur.dev', name: 'x', password: 'test-password', role: 'admin' },
        overrideAccess: false,
        user,
      }),
    ).rejects.toThrow(Forbidden)

    const updated = await payload.update({
      collection: 'users',
      data: { name: 'Nombre nuevo', role: 'superadmin' },
      id: client.id,
      overrideAccess: false,
      user,
    })
    expect(updated.name).toBe('Nombre nuevo')
    expect(updated.role).toBe('admin')
  })

  it('el administrador no puede actualizar ni borrar documentos ajenos, ni borrar el suyo propio', async () => {
    const client = await payload.findByID({ collection: 'users', id: ids[emails[2]] })
    const user = { ...client, collection: 'users' as const }

    // Actualizar el documento de otro usuario: `isSuperAdminOrSelf` responde con una
    // restricción `where` que excluye el documento ajeno; el CMS responde con Forbidden.
    await expect(
      payload.update({
        collection: 'users',
        data: { name: 'Intento ajeno' },
        id: ids[emails[0]],
        overrideAccess: false,
        user,
      }),
    ).rejects.toThrow(Forbidden)

    // Borrar el documento de otro usuario: `delete` exige `isSuperAdmin`, que responde
    // `false` sin más; el CMS responde con Forbidden antes de buscar el documento.
    await expect(
      payload.delete({ collection: 'users', id: ids[emails[0]], overrideAccess: false, user }),
    ).rejects.toThrow(Forbidden)

    // Borrar el propio documento: `delete` es solo para el superadministrador, así que
    // tampoco el administrador puede borrarse a sí mismo. También Forbidden.
    await expect(
      payload.delete({ collection: 'users', id: client.id, overrideAccess: false, user }),
    ).rejects.toThrow(Forbidden)
  })

  // Dins d'aquest `describe` perquè aquí ja hi ha, segur, dos superadmins.
  it('impide degradar o borrar al último superadministrador', async () => {
    const { docs } = await payload.find({
      collection: 'users',
      limit: 0,
      pagination: false,
      where: { role: { equals: 'superadmin' } },
    })
    const [last, ...others] = docs
    for (const other of others) {
      await payload.update({ collection: 'users', data: { role: 'admin' }, id: other.id })
    }
    try {
      await expect(
        payload.update({ collection: 'users', data: { role: 'admin' }, id: last.id }),
      ).rejects.toThrow(/superadministrador/)
      await expect(payload.delete({ collection: 'users', id: last.id })).rejects.toThrow(
        /superadministrador/,
      )
    } finally {
      for (const other of others) {
        await payload.update({ collection: 'users', data: { role: 'superadmin' }, id: other.id })
      }
    }
  })

  it('el borrado por `where` no rechaza la promesa: la guarda deja el error en `errors[]`', async () => {
    const { docs } = await payload.find({
      collection: 'users',
      limit: 0,
      pagination: false,
      where: { role: { equals: 'superadmin' } },
    })
    const [last, ...others] = docs
    for (const other of others) {
      await payload.update({ collection: 'users', data: { role: 'admin' }, id: other.id })
    }
    try {
      const result = await payload.delete({
        collection: 'users',
        where: { id: { equals: last.id } },
      })
      expect(result.docs).toEqual([])
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toMatch(/superadministrador/)

      const stillThere = await payload.findByID({ collection: 'users', id: last.id })
      expect(stillThere.id).toBe(last.id)
    } finally {
      for (const other of others) {
        await payload.update({ collection: 'users', data: { role: 'superadmin' }, id: other.id })
      }
    }
  })
})
