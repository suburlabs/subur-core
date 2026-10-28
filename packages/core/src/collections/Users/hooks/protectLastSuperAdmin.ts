import { sql } from '@payloadcms/db-postgres'
import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type PayloadRequest,
} from 'payload'

const MESSAGE = 'Debe quedar al menos un superadministrador.'

type TransactionalDb = { execute: (query: unknown) => Promise<unknown> }
type DrizzleAdapter = {
  drizzle: TransactionalDb
  sessions: Record<string | number, { db: TransactionalDb } | undefined>
}

/**
 * Bloqueja les files dels superadministradors dins de la transacció de la
 * petició abans de comptar-les. Sense això, dues degradacions simultànies
 * veurien cadascuna l'altre superadministrador i passarien totes dues
 * (full de ruta §11). La sessió es resol com fa el mateix adaptador
 * (`getTransaction`: `sessions[transactionID]?.db || drizzle`); fora d'una
 * transacció el bloqueig s'allibera de seguida i només queda el recompte.
 *
 * L'`ORDER BY id` fixa un ordre de bloqueig determinista: dues peticions que
 * bloquegen el mateix conjunt de files sempre hi entren en el mateix ordre i no
 * es poden abraçar en un interbloqueig.
 *
 * El recompte que ve després del bloqueig veu el commit de l'altra transacció
 * perquè l'aïllament és READ COMMITTED (el de Postgres per defecte, i el que fa
 * servir l'adaptador): en desbloquejar-se, la consulta pren una instantània nova.
 * Amb REPEATABLE READ el `FOR UPDATE` acabaria en un error de serialització en
 * lloc del missatge de la guarda.
 */
const lockSuperAdmins = async (req: PayloadRequest): Promise<void> => {
  const adapter = req.payload.db as unknown as DrizzleAdapter
  const transactionID = await req.transactionID
  const db = (transactionID !== undefined && adapter.sessions[transactionID]?.db) || adapter.drizzle
  await db.execute(sql`SELECT id FROM users WHERE role = 'superadmin' ORDER BY id FOR UPDATE`)
}

const otherSuperAdmins = async (req: PayloadRequest, id: number | string): Promise<number> => {
  await lockSuperAdmins(req)
  const { totalDocs } = await req.payload.count({
    collection: 'users',
    req,
    where: { and: [{ role: { equals: 'superadmin' } }, { id: { not_equals: id } }] },
  })
  return totalDocs
}

export const protectLastSuperAdminOnChange: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const demoted =
    operation === 'update' &&
    originalDoc?.role === 'superadmin' &&
    data.role !== undefined &&
    data.role !== 'superadmin'

  if (demoted && (await otherSuperAdmins(req, originalDoc.id)) === 0) {
    throw new APIError(MESSAGE, 400)
  }

  return data
}

// Un `delete` per `id` rebutja la promesa si aquesta guarda llança. Un `delete` per `where`
// no: el CMS atrapa l'error de cada document i el posa a `result.errors[]`, sense esborrar-lo
// ni rebutjar l'operació sencera — qui ignori `errors` no s'assabentarà que s'ha bloquejat.
export const protectLastSuperAdminOnDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = await req.payload.findByID({ collection: 'users', depth: 0, id, req })

  if (doc.role === 'superadmin' && (await otherSuperAdmins(req, id)) === 0) {
    throw new APIError(MESSAGE, 400)
  }
}
