import config from '../fixtures/app/src/payload.config.js'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Amb SQLite hi havia un sol escriptor. Amb Postgres, dues degradacions
 * simultànies llegirien cadascuna «queda un altre superadministrador» i
 * passarien totes dues: la guarda ha de bloquejar les files abans de comptar.
 */
describe('guarda de l’últim superadministrador sota concurrència', () => {
  let payload: Payload
  const emails = ['g3-lock-a@subur.dev', 'g3-lock-b@subur.dev']
  const ids: number[] = []
  let others: number[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    // Els altres superadmins (el d'ensureSuperAdmin) es degraden a admin durant la prova
    // perquè els dos de prova siguin els únics; es restauren al final.
    const existing = await payload.find({
      collection: 'users',
      depth: 0,
      limit: 100,
      where: { role: { equals: 'superadmin' } },
    })
    for (const email of emails) {
      const user = await payload.create({
        collection: 'users',
        data: { email, name: email, password: 'test-password', role: 'superadmin' },
      })
      ids.push(user.id)
    }
    others = existing.docs.map((doc) => doc.id)
    for (const id of others) {
      await payload.update({ collection: 'users', data: { role: 'admin' }, id })
    }
    // El pool de connexions n'obre a demanda. Amb una sola connexió calenta, la
    // segona transacció es passa una desena de mil·lisegons establint-ne una
    // altra i per llavors la primera ja ha acabat: les dues degradacions no
    // arribarien mai a solapar-se i la prova passaria amb guarda i sense.
    // Aquestes dues escriptures simultànies sí que escriuen (`updated_at` canvia
    // sempre); el que importa és que només toquen `name` i, per tant, la guarda
    // de l'últim superadministrador no s'executa. En acabar, el pool té les dues
    // connexions obertes i a partir d'aquí la concurrència és real.
    await Promise.all(
      ids.map((id, index) =>
        payload.update({ collection: 'users', data: { name: emails[index] }, id }),
      ),
    )
    // L'escalfament és el requisit de tota la prova, i és invisible: si el pool
    // es quedés amb una sola connexió, el cas de sota passaria sense provar res.
    // `pool` és el `pg.Pool` de l'adaptador de Postgres, i `totalCount` compta
    // les connexions obertes (ocupades, lliures i esperant).
    expect(payload.db.pool.totalCount).toBeGreaterThanOrEqual(2)
  })

  afterAll(async () => {
    for (const id of others) {
      await payload.update({ collection: 'users', data: { role: 'superadmin' }, id })
    }
    // Un a un per `id`: el `delete` en bloc per `where` resol igualment quan una
    // guarda bloqueja un document (l'error acaba a `result.errors[]`), de manera
    // que una neteja incompleta passaria desapercebuda.
    for (const id of ids) {
      await payload.delete({ collection: 'users', id })
    }
  })

  it('de dues degradacions simultànies, exactament una és rebutjada', async () => {
    const results = await Promise.allSettled(
      ids.map((id) => payload.update({ collection: 'users', data: { role: 'admin' }, id })),
    )
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(/superadministrador/)

    const { totalDocs } = await payload.count({
      collection: 'users',
      where: { role: { equals: 'superadmin' } },
    })
    expect(totalDocs).toBe(1)
  })
})
