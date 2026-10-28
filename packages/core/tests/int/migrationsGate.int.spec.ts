import { describe, expect, it } from 'vitest'

import { shouldRunMigrations } from '../../src/utilities/migrationsGate.js'

describe('shouldRunMigrations', () => {
  it('no corre si no hi ha SUBUR_RUN_MIGRATIONS (pnpm build i pnpm dev locals)', () => {
    expect(shouldRunMigrations({})).toBe(false)
    expect(shouldRunMigrations({ NODE_ENV: 'production' })).toBe(false)
  })

  it('no corre amb un valor diferent de "1"', () => {
    expect(shouldRunMigrations({ SUBUR_RUN_MIGRATIONS: 'true' })).toBe(false)
    expect(shouldRunMigrations({ SUBUR_RUN_MIGRATIONS: '0' })).toBe(false)
  })

  it('no depèn de cap variable interna de Next: NEXT_PHASE sol no fa res', () => {
    expect(shouldRunMigrations({ NEXT_PHASE: 'phase-production-server' })).toBe(false)
  })

  it('corre quan el contenidor ho demana explícitament (web i seed a docker-compose.yml)', () => {
    expect(shouldRunMigrations({ SUBUR_RUN_MIGRATIONS: '1' })).toBe(true)
  })
})
