import config from '../fixtures/app/src/payload.config.js'
import { Forbidden, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const context = { disableRevalidate: true }

/**
 * Cada fila de la taula d'accés de `redirects` (§18.1) necessita una prova
 * que hi passi de debò, no només una prova unitària de la funció.
 */
describe('control de acceso de redirecciones', () => {
  let payload: Payload
  const emails = { admin: 'f4-admin@subur.dev', superadmin: 'f4-superadmin@subur.dev' }
  const ids: Record<'admin' | 'superadmin', number> = { admin: 0, superadmin: 0 }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await payload.delete({ collection: 'users', where: { email: { in: Object.values(emails) } } })

    for (const [key, role] of [
      ['admin', 'admin'],
      ['superadmin', 'superadmin'],
    ] as const) {
      const user = await payload.create({
        collection: 'users',
        data: { email: emails[key], name: emails[key], password: 'test-password', role },
      })
      ids[key] = user.id
    }
  })

  afterAll(async () => {
    // Aquí ja hi ha un altre superadministrador real (`admin@subur.dev`), així que
    // borrar el de prova no xoca amb la guarda de l'últim superadministrador.
    await payload.delete({ collection: 'users', where: { email: { in: Object.values(emails) } } })
    // La red de seguridad también invalida como el resto del fichero: sin `context`,
    // este borrado dispararía una revalidación desde las pruebas.
    await payload.delete({ collection: 'redirects', context, where: { from: { like: '/f4-%' } } })

    const remainingUsers = await payload.find({
      collection: 'users',
      where: { email: { like: 'f4-%' } },
    })
    expect(remainingUsers.docs).toEqual([])

    const remainingRedirects = await payload.find({
      collection: 'redirects',
      where: { from: { like: '/f4-%' } },
    })
    expect(remainingRedirects.docs).toEqual([])
  })

  it('el administrador del cliente no puede crear, listar, actualizar ni borrar redirecciones', async () => {
    const clientDoc = await payload.findByID({ collection: 'users', id: ids.admin })
    const client = { ...clientDoc, collection: 'users' as const }

    await expect(
      payload.create({
        collection: 'redirects',
        data: { from: '/f4-cliente-crea', to: { type: 'custom', url: '/destino' } },
        overrideAccess: false,
        user: client,
      }),
    ).rejects.toThrow(Forbidden)

    // El acceso de lectura también deniega: `find` con `overrideAccess: false` y sin
    // `disableErrors` lanza Forbidden (comprobado en `node_modules/payload/dist/auth/executeAccess.js`;
    // no devuelve una lista vacía en silencio).
    await expect(
      payload.find({ collection: 'redirects', overrideAccess: false, user: client }),
    ).rejects.toThrow(Forbidden)

    // Para probar `update`/`delete` hace falta una redirección existente, creada con acceso completo.
    const seeded = await payload.create({
      collection: 'redirects',
      context,
      data: { from: '/f4-cliente-existente', to: { type: 'custom', url: '/destino' } },
    })

    try {
      await expect(
        payload.update({
          collection: 'redirects',
          data: { to: { type: 'custom', url: '/otro-destino' } },
          id: seeded.id,
          overrideAccess: false,
          user: client,
        }),
      ).rejects.toThrow(Forbidden)

      await expect(
        payload.delete({ collection: 'redirects', id: seeded.id, overrideAccess: false, user: client }),
      ).rejects.toThrow(Forbidden)
    } finally {
      await payload.delete({ collection: 'redirects', context, id: seeded.id })
    }
  })

  it('el superadministrador puede crear, actualizar y borrar una redirección', async () => {
    const superDoc = await payload.findByID({ collection: 'users', id: ids.superadmin })
    const superUser = { ...superDoc, collection: 'users' as const }

    const created = await payload.create({
      collection: 'redirects',
      context,
      data: { from: '/f4-superadmin-crea', to: { type: 'custom', url: '/destino' } },
      overrideAccess: false,
      user: superUser,
    })
    expect(created.from).toBe('/f4-superadmin-crea')

    const updated = await payload.update({
      collection: 'redirects',
      context,
      data: { to: { type: 'custom', url: '/destino-actualizado' } },
      id: created.id,
      overrideAccess: false,
      user: superUser,
    })
    expect(updated.to?.url).toBe('/destino-actualizado')

    const deleted = await payload.delete({
      collection: 'redirects',
      context,
      id: created.id,
      overrideAccess: false,
      user: superUser,
    })
    expect(deleted.id).toBe(created.id)
  })
})
