import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload'

import { tombstoneAll } from '../cache/flush.js'

/**
 * Hook únic d'invalidació (spec §26.4). Qualsevol escriptura publicada,
 * despublicació o esborrat a una col·lecció o un global que alimenti la web
 * pública invalida **tot l'arbre** amb l'etiqueta reservada `'*'`, que el
 * handler comprova a cada lectura i a cada escriptura. Substitueix els hooks
 * per document: les dependències entre documents (un enllaç del menú, una
 * imatge, un formulari) no necessiten cap inventari d'etiquetes.
 *
 * La mateixa cadena que `ALL_TAG` de `src/cache/handler.js`; no s'importa el
 * handler des del graf del CMS (hi posaria un segon pool): un test comprova
 * que coincideixen.
 */
export const CACHE_ALL_TAG = '*'

/** Marge de la làpida escrita fora d'una petició: cobreix la confirmació de la transacció. */
const TOMBSTONE_MARGIN_SECONDS = 60

type WithStatus = { _status?: string | null } | null | undefined

const isPublished = (doc: WithStatus) => doc?._status === 'published'

/**
 * Amb esborranys: compta si el document nou o l'anterior està publicat
 * (publicar i despublicar són urgents); sense esborranys: sempre. En crear, el
 * CMS passa `previousDoc: {}`, de manera que un esborrany nou no invalida.
 */
export function shouldInvalidate(hasDrafts: boolean, doc: WithStatus, previousDoc?: WithStatus): boolean {
  if (!hasDrafts) return true
  return isPublished(doc) || isPublished(previousDoc)
}

/**
 * Làpida amb marge per la connexió del CMS (fora de la transacció del desat).
 * Mai llança: un `afterChange` que llança abans de confirmar desfà el desat.
 */
async function tombstoneWithMargin(req: PayloadRequest): Promise<void> {
  try {
    await tombstoneAll(req.payload.db.drizzle, TOMBSTONE_MARGIN_SECONDS)
  } catch (error) {
    req.payload.logger.error(`[cache] invalidation failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Invalida tot l'arbre. Dins d'una petició HTTP (`req.payloadAPI` REST o
 * GraphQL): `revalidateTag('*', { expire: 0 })`, que corre a `waitUntil`,
 * després de la resposta i de la confirmació; si llança, la làpida amb marge.
 * En qualsevol altre origen (`local`: tasques, scripts, `onInit`): sempre la
 * làpida amb marge. No llança mai.
 */
export async function invalidateSiteCache(req: PayloadRequest, reason: string): Promise<void> {
  if (req.context.disableRevalidate) return
  req.payload.logger.info(`Memòria cau del web invalidada (${reason})`)
  // El camí es tria per l'origen de la petició, no per si `revalidateTag`
  // llança: els crons del CMS (publicacions programades, tasques) hereten per
  // AsyncLocalStorage el `workStore` de la petició REST que els va engegar, on
  // `revalidateTag` no llança però encua en un store que ja no s'executarà
  // mai. Només una petició HTTP viva té un `waitUntil` que invalidi.
  if (req.payloadAPI === 'REST' || req.payloadAPI === 'GraphQL') {
    try {
      // Import dinàmic: el graf de configuració no importa `next/*` estàticament. Amb l'extensió perquè `next` no
      // té `exports`: Node pla no resol `next/cache`, però sí `next/cache.js` (i el bundler també).
      const { revalidateTag } = await import('next/cache.js')
      revalidateTag(CACHE_ALL_TAG, { expire: 0 })
      return
    } catch (error) {
      // Si falla el mateix import, s'avisa: no és el cas esperat (sense store) i amagar-lo deixaria la causa muda.
      if ((error as { code?: unknown } | null)?.code === 'ERR_MODULE_NOT_FOUND') {
        req.payload.logger.warn(`[cache] next/cache no es pot carregar; es fa servir la làpida: ${error instanceof Error ? error.message : String(error)}`)
      }
      // Sense store, o cridat durant un render: cau al camí de la làpida.
    }
  }
  await tombstoneWithMargin(req)
}

export const invalidateAfterChange: CollectionAfterChangeHook = async ({ collection, doc, previousDoc, req }) => {
  if (shouldInvalidate(Boolean(collection.versions?.drafts), doc, previousDoc)) {
    await invalidateSiteCache(req, `${collection.slug} ${doc?.id ?? ''}`.trim())
  }
  return doc
}

export const invalidateAfterDelete: CollectionAfterDeleteHook = async ({ collection, doc, req }) => {
  await invalidateSiteCache(req, `${collection.slug} esborrat`)
  return doc
}

export const invalidateGlobalAfterChange: GlobalAfterChangeHook = async ({ doc, global, req }) => {
  await invalidateSiteCache(req, global.slug)
  return doc
}
