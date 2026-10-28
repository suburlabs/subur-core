import type { BasePayload, Endpoint } from 'payload'

import { mediaStorage, s3Config } from '../storage/s3.js'
import { resolvePlan } from '../subur/plan.js'
import { ensureSuperAdmin } from '../utilities/ensureSuperAdmin.js'
import { shouldRunMigrations } from '../utilities/migrationsGate.js'

type Env = Record<string, string | undefined>

/**
 * Salut del servei: la base de dades respon i la invariant de comptes es manté.
 *
 * `ensureSuperAdmin` es torna a cridar aquí a posta. Si va fallar en arrencar,
 * el motor no la torna a executar mai en aquell procés (vegeu-ne el comentari):
 * la salut és l'únic lloc que se n'adona. Si ja hi ha superadministrador, és
 * un sol recompte; si no n'hi ha, o bé el crea des de l'entorn o bé llança, i
 * el contenidor es queda `unhealthy` amb el motiu al registre. Això no atura
 * res: Caddy no llegeix la salut de Docker i la web continua servint
 * peticions, així que és l'operador qui ho ha de mirar (`$C ps` i aquesta
 * mateixa ruta) abans d'apuntar el DNS — runbook §4 i §12.
 *
 * En el servidor real també exigeix una tria explícita d'emmagatzematge:
 * `MEDIA_STORAGE=s3` amb les seves variables, o `local`.
 */
export const checkHealth = async (
  payload: BasePayload,
  env: Env = process.env,
): Promise<Response> => {
  try {
    await payload.count({ collection: 'pages' })
    await ensureSuperAdmin(payload, env)
    if (shouldRunMigrations(env)) {
      // Llença amb el nom de la variable que falta o no val (spec §23.5):
      // sense MEDIA_STORAGE, o amb `s3` a mitges, el contenidor queda unhealthy.
      if (mediaStorage(env) === 's3') s3Config(env)
    }
    // Lectura directa, sense memòria cau: la salut no n'ha de dependre. `plan` no
    // és cap secret (el contracte del client, no una dada seva) i és el senyal
    // que llegeixen l'informe i `ops` (spec §24.7).
    const subscription = await payload.findGlobal({ depth: 0, slug: 'subscription' })
    return Response.json({ plan: resolvePlan(subscription.plan), status: 'ok' })
  } catch (err) {
    // El motiu només es veu aquí: el contenidor queda unhealthy i el registre
    // és l'únic lloc on l'operador pot saber per què.
    payload.logger.error({ err }, 'Salud: comprobación fallida')
    return Response.json({ status: 'error' }, { status: 503 })
  }
}

/** Per al HEALTHCHECK del contenidor i per a la monitorització externa. */
export const healthEndpoint: Endpoint = {
  handler: (req) => checkHealth(req.payload),
  method: 'get',
  path: '/health',
}
