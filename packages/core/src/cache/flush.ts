import { sql } from '@payloadcms/db-postgres'

/**
 * L'únic lloc del CMS on s'escriu l'SQL de la làpida global `'*'` (spec §26.4).
 * La fan servir el hook únic d'invalidació i el seed. No importa el handler
 * (`src/cache/handler.js`) a propòsit: posaria el seu pool dins del graf del
 * CMS; la cadena `'*'` és la mateixa per contracte i un test ho comprova.
 */
type Executor = { execute(query: unknown): Promise<unknown> }

/**
 * Marca `'*'` com a invalidada fins a `ara + marginSeconds` (rellotge de
 * Postgres): tota entrada desada per un render començat abans d'aquest moment
 * queda morta. El marge és un paràmetre de la consulta, mai text interpolat.
 * `greatest` fa que una làpida amb marge no s'escurci mai amb una de posterior.
 */
export async function tombstoneAll(db: Executor, marginSeconds = 0): Promise<void> {
  await db.execute(sql`
    insert into next_cache_tags (tag, invalidated_at)
    values ('*', clock_timestamp() + make_interval(secs => ${marginSeconds}))
    on conflict (tag) do update set invalidated_at = greatest(next_cache_tags.invalidated_at, excluded.invalidated_at)
  `)
}

/** Buida les entrades desades; mai toca `next_cache_tags` (les làpides garanteixen la correcció). */
export async function clearCacheRows(db: Executor): Promise<void> {
  await db.execute(sql`delete from next_cache`)
}
