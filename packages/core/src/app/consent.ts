import { getConsentBackend } from '../consent/backend.js'
import { withConsentLimits } from '../consent/rateLimit.js'

/**
 * El backend de consentiment de c15t (spec §21.2) amb els límits de peticions. El fitxer de ruta del client l'exporta
 * com a `DELETE`, `GET`, `PATCH`, `POST` i `PUT`, amb `dynamic = 'force-dynamic'` literal (Next el llegeix de manera
 * estàtica): mai s'ha de prerenderitzar ni desar a la memòria cau.
 */
export function createConsentRoute() {
  return { handler: withConsentLimits((request: Request) => getConsentBackend().handler(request)) }
}
