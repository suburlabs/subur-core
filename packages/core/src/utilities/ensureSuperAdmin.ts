import type { BasePayload } from 'payload'

import { shouldRunMigrations } from './migrationsGate.js'

type Env = Record<string, string | undefined>

/**
 * El primer superadmin no es crea mai des de la pantalla «primer usuari»,
 * que donaria el compte a qui entrés primer a `/admin`. Es crea aquí, en
 * arrencar, des de l'entorn. El senyal de «servidor real» és el mateix que
 * aplica les migracions (`SUBUR_RUN_MIGRATIONS=1`, només als serveis `web` i
 * `seed` del compose): cap `pnpm build` ni `pnpm dev` local el defineix.
 *
 * Que aquesta funció llanci NO atura el servidor. El motor s'inicialitza a la
 * primera petició; si `onInit` llança, només falla aquella petició: l'error
 * es registra, la promesa en memòria cau es descarta però l'entrada hi queda,
 * i la petició següent es torna a inicialitzar amb `disableOnInit`, sense
 * tornar a passar mai per aquí en aquell procés (`dist/index.js` del paquet
 * instal·lat, `init()` i `getPayload()`). Qui manté la línia són dues coses:
 * `/api/health`, que torna a cridar aquesta funció a cada comprovació i deixa
 * el contenidor `unhealthy` — un senyal, no un fre: Caddy no llegeix la salut
 * de Docker i la web es continua publicant, de manera que l'operador ha de
 * comprovar `$C ps` i `/api/health` abans d'apuntar el DNS (runbook §4 i
 * §12) —, i `requireSuperAdminToCreate`, que tanca l'alta d'usuaris per HTTP
 * encara que el servei acabi servint peticions.
 */
export async function ensureSuperAdmin(
  payload: BasePayload,
  env: Env = process.env,
): Promise<'created' | 'exists' | 'promoted' | 'skipped'> {
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: { role: { equals: 'superadmin' } },
  })
  if (totalDocs > 0) return 'exists'

  // El email es normalitza a minúscules perquè el propi CMS ho fa en desar
  // qualsevol usuari (camp `email` base de `auth`, `beforeChange` intern):
  // buscar-lo tal qual arriba de l'entorn no trobaria l'usuari ja creat.
  const email = env.SUBUR_ADMIN_EMAIL?.trim().toLowerCase()
  const password = env.SUBUR_ADMIN_PASSWORD

  // Un valor només d'espais compta com a absent: mai s'usa tal qual com a
  // contrasenya real (aquí és on es fa l'únic `trim()`). La contrasenya que
  // arriba a `create` és sempre la de l'entorn, intacta.
  if (!email || !password || password.trim().length === 0) {
    const message =
      'No hay ningún superadministrador y faltan SUBUR_ADMIN_EMAIL o SUBUR_ADMIN_PASSWORD.'
    if (shouldRunMigrations(env)) throw new Error(message)
    payload.logger.warn(message)
    return 'skipped'
  }

  const { docs } = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    where: { email: { equals: email } },
  })

  if (docs[0]) {
    await payload.update({ collection: 'users', data: { role: 'superadmin' }, id: docs[0].id })
    payload.logger.info(`Superadministrador: ${email} ascendido`)
    return 'promoted'
  }

  await payload.create({
    collection: 'users',
    data: { email, name: 'Subur', password, role: 'superadmin' },
  })
  payload.logger.info(`Superadministrador: ${email} creado`)
  return 'created'
}
