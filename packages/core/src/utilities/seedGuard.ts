type Env = Record<string, string | undefined>

/**
 * El seed esborra pàgines, formularis i imatges abans de crear-los de nou. En
 * desenvolupament és el que volem; en producció destruiria el contingut que el
 * client ha editat. Per això, en producció i amb contingut, només corre si es
 * força explícitament.
 */
export function assertSeedAllowed({ env, existingPages }: { env: Env; existingPages: number }): void {
  if (existingPages === 0) return
  if (env.NODE_ENV !== 'production') return
  if (env.SEED_FORCE === '1') return

  throw new Error(
    `Seed cancelado: la base de datos ya tiene ${existingPages} páginas y el seed las borraría. ` +
      'Si de verdad quiere sustituir todo el contenido, vuelva a ejecutarlo con SEED_FORCE=1.',
  )
}
