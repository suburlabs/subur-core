import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Memòria cau persistent de Next (spec §26.3): les entrades de rutes i de dades
 * (`next_cache`) i les làpides per etiqueta (`next_cache_tags`). No són taules
 * del CMS: la migració s'escriu a mà, com la de c15t, i l'instantani `.json` és
 * el de la migració anterior sense canvis. Les dades de totes dues queden fora
 * de les còpies (`backup.sh`, `--exclude-table-data`): una restauració comença
 * amb la cau buida.
 *
 * Idempotent: restaurar una còpia d'abans de K2 sobre una base ja migrada torna
 * `payload_migrations` sense aquesta fila però deixa les dues taules (el
 * `pg_restore --clean` només toca el que porta l'arxiu). Llavors la migració
 * torna a córrer: `IF NOT EXISTS` evita que `web` caigui en bucle, i el `DELETE`
 * buida les files, que són d'un contingut que la restauració acaba de substituir.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS public.next_cache (
      key text PRIMARY KEY,
      build text NOT NULL,
      kind text NOT NULL,
      payload text NOT NULL,
      tags text[] NOT NULL DEFAULT '{}',
      revalidate integer,
      started_at timestamptz NOT NULL,
      last_modified timestamptz NOT NULL
    );
    CREATE INDEX IF NOT EXISTS next_cache_tags_idx ON public.next_cache USING gin (tags);
    CREATE TABLE IF NOT EXISTS public.next_cache_tags (
      tag text PRIMARY KEY,
      invalidated_at timestamptz NOT NULL
    );
    DELETE FROM public.next_cache;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS public.next_cache_tags;
    DROP TABLE IF EXISTS public.next_cache;
  `)
}
