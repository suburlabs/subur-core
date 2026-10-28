import { type CollectionBeforeOperationHook, Forbidden } from 'payload'

import { isSuperAdminUser } from '../../../access/roles.js'

/**
 * Tanca l'alta d'usuaris per HTTP.
 *
 * L'endpoint «primer usuari» del motor crida `create` amb `overrideAccess: true`:
 * ni `access.create` de la col·lecció ni l'accés del camp `role` s'hi apliquen.
 * Amb la base de dades buida, qualsevol petició anònima es podria fer
 * superadministradora. Aquesta guarda corre a `beforeOperation`, abans que
 * l'operació faci res, i no mira l'accés sinó d'on ve la petició:
 *
 * - `payloadAPI === 'local'`: l'arrencada (`ensureSuperAdmin`), el seed, el CLI
 *   i les proves. Passen sempre; no hi ha cap petició externa al darrere.
 * - `'REST'` o `'GraphQL'`: només si qui la fa ja és superadministrador. Així
 *   el superadministrador pot crear l'usuari del client des del panell, i
 *   l'endpoint de «primer usuari» no pot crear res encara que s'hi arribi.
 *
 * `req.payloadAPI` el fixa el motor: `'REST'`/`'GraphQL'` en crear la petició i
 * `'local'` només si no en venia cap (comprovat a `dist/utilities/createLocalReq.js`
 * i `dist/utilities/createPayloadRequest.js` del paquet instal·lat). L'endpoint
 * de «primer usuari» passa la seva pròpia petició REST a `create`, de manera que
 * el valor no es degrada a `'local'`.
 */
export const requireSuperAdminToCreate: CollectionBeforeOperationHook = (hookArgs) => {
  const { args, operation, req } = hookArgs

  if (operation === 'create' && req.payloadAPI !== 'local' && !isSuperAdminUser(req.user)) {
    throw new Forbidden(req.t)
  }

  // El motor espera els arguments de l'operació de tornada, intactes.
  return args
}
