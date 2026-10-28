import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

export interface TestUser {
  email: string
  password: string
  role: 'admin' | 'superadmin'
}

/** Usuari de Subur: veu tot el panell. */
export const testUser: TestUser = {
  email: 'dev@subur.dev',
  password: 'test',
  role: 'superadmin',
}

/** Usuari del client: només el seu contingut. */
export const testClientUser: TestUser = {
  email: 'cliente@subur.dev',
  password: 'test',
  role: 'admin',
}

/**
 * Sembra un usuari de prova. Accepta un usuari perquè els fitxers que corren
 * en paral·lel facin servir adreces diferents.
 */
export async function seedTestUser(user: TestUser = testUser): Promise<void> {
  const payload = await getPayload({ config })

  const deleted = await payload.delete({
    collection: 'users',
    where: { email: { equals: user.email } },
  })
  if (deleted.errors.length > 0) {
    throw new Error(
      `No se pudo limpiar el usuario de prueba "${user.email}" antes de sembrarlo: ${deleted.errors.map((error) => error.message).join('; ')}`,
    )
  }

  await payload.create({ collection: 'users', data: { ...user, name: user.email } })
}

export async function cleanupTestUser(user: TestUser = testUser): Promise<void> {
  const payload = await getPayload({ config })

  const deleted = await payload.delete({
    collection: 'users',
    where: { email: { equals: user.email } },
  })
  if (deleted.errors.length > 0) {
    throw new Error(
      `No se pudo eliminar el usuario de prueba "${user.email}": ${deleted.errors.map((error) => error.message).join('; ')}`,
    )
  }
}
