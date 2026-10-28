type Env = Record<string, string | undefined>

/**
 * Condició positiva i nostra, no un intern de Next: `NEXT_PHASE ===
 * 'phase-production-build'` només arriba a l'estat segur quan aquella
 * variable interna coincideix amb una cadena màgica — si Next la canviés de
 * nom o no la propagués, tornaríem silenciosament a aplicar migracions
 * (el bug real del 2026-09-19: un `pnpm build` local aplicant-les contra la
 * base de dades de desenvolupament). Amb aquesta funció, les migracions
 * només corren quan el contenidor ho demana explícitament.
 */
export function shouldRunMigrations(env: Env): boolean {
  return env.SUBUR_RUN_MIGRATIONS === '1'
}
