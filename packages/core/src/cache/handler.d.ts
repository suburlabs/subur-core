import type { CacheHandler, CacheHandlerContext, CacheHandlerValue } from 'next/dist/server/lib/incremental-cache'

/** `cacheHandler` de Next sobre el Postgres del client (spec §26). La implementació és `handler.js`. */
export default class SuburCacheHandler implements CacheHandler {
  constructor(options: CacheHandlerContext)
  get(key: string, ctx?: { kind?: string; tags?: string[]; softTags?: string[] }): Promise<CacheHandlerValue | null>
  set(
    key: string,
    data: unknown,
    ctx?: { tags?: string[]; cacheControl?: { revalidate?: number | false; expire?: number } },
  ): Promise<void>
  revalidateTag(tags: string | string[], durations?: { expire?: number }): Promise<void>
  resetRequestCache(): void
  /** Intern; públic per als tests: `started_at` per clau (ms, rellotge de Postgres), el mínim dels get d'aquella clau. */
  readonly startedAt: Map<string, number>
}

/** Tanca el pool (tests). */
export function endPool(): Promise<void>

/** Només per als tests: oblida el BUILD_ID llegit, la bandera de purga i els avisos d'inert. */
export function resetModuleState(): void

export const ALL_TAG: '*'
