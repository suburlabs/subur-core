import config from '../fixtures/app/src/payload.config.js'
import { Forbidden, getPayload } from 'payload'
import { describe, expect, it } from 'vitest'

import { requireSuperAdminToCreate } from '../../src/collections/Users/hooks/requireSuperAdminToCreate.js'

type HookCase = {
  operation?: string
  payloadAPI?: string
  user?: unknown
}

const incoming = { collection: { config: { slug: 'users' } }, data: { email: 'x@x.example' } }

const hookArgs = ({ operation = 'create', payloadAPI = 'REST', user = null }: HookCase = {}) =>
  ({
    args: incoming,
    collection: { slug: 'users' },
    context: {},
    operation,
    req: { payloadAPI, user },
  }) as never

describe('requireSuperAdminToCreate', () => {
  it('rechaza un alta por HTTP sin ningún usuario en sesión', () => {
    expect(() => requireSuperAdminToCreate(hookArgs())).toThrow(Forbidden)
  })

  it('rechaza un alta por HTTP hecha por el administrador del cliente', () => {
    expect(() => requireSuperAdminToCreate(hookArgs({ user: { id: 2, role: 'admin' } }))).toThrow(
      Forbidden,
    )
  })

  it('rechaza un alta por GraphQL sin superadministrador', () => {
    expect(() => requireSuperAdminToCreate(hookArgs({ payloadAPI: 'GraphQL' }))).toThrow(Forbidden)
  })

  it('deja pasar un alta por HTTP hecha por el superadministrador', () => {
    const args = hookArgs({ user: { id: 1, role: 'superadmin' } })
    expect(requireSuperAdminToCreate(args)).toBe(incoming)
  })

  it('deja pasar la API local: el arranque, la siembra y las pruebas', () => {
    const args = hookArgs({ payloadAPI: 'local' })
    expect(requireSuperAdminToCreate(args)).toBe(incoming)
  })

  it('no toca las demás operaciones', () => {
    for (const operation of ['login', 'read', 'update', 'delete', 'refresh', 'resetPassword']) {
      const args = hookArgs({ operation })
      expect(requireSuperAdminToCreate(args), operation).toBe(incoming)
    }
  })
})

describe('la colección de usuarios está cableada contra el alta abierta', () => {
  it('lleva la guarda en `hooks.beforeOperation`', async () => {
    const payload = await getPayload({ config })
    // La configuració del client de prova arriba de `dist/` (`@suburlabs/core/config`): el cablejat es mira contra la
    // funció d'aquell mòdul, no contra la de `src/` (una altra instància).
    const wired = await import('../../dist/collections/Users/hooks/requireSuperAdminToCreate.js')
    expect(payload.collections.users.config.hooks.beforeOperation).toContain(
      wired.requireSuperAdminToCreate,
    )
  })

  it('nuestra ruta `/first-register` se resuelve antes que la del motor', async () => {
    const payload = await getPayload({ config })
    const endpoints = payload.collections.users.config.endpoints

    if (endpoints === false) throw new Error('La colección de usuarios no expone ningún endpoint.')

    const matches = endpoints.filter(
      (endpoint) => endpoint.method === 'post' && endpoint.path === '/first-register',
    )
    // Dos: la nuestra y la del motor. El despachador toma la primera que coincide.
    expect(matches).toHaveLength(2)

    const response = await matches[0].handler({} as never)
    expect(response.status).toBe(404)
  })
})
