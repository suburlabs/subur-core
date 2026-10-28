/**
 * Termini de *stale-while-revalidate* de tot el que es desa a la memòria cau
 * persistent (spec §26.4): l'HTML de la ruta (`revalidate` del layout públic) i
 * les entrades d'`unstable_cache`. No és una garantia d'edat: la invalidació
 * immediata la dóna el hook únic (`'*'`) i aquest dia només cobreix el que cap
 * hook ni `pnpm ops cache flush` han tocat (`psql`, migracions de dades). Sense
 * una visita que el desencadeni, el contingut pot ser més antic.
 */
export const CACHE_REVALIDATE_SECONDS = 86400
