import { describe, expect, it } from 'vitest'

import { assertSeedAllowed } from '../../src/utilities/seedGuard.js'

describe('assertSeedAllowed', () => {
  it('siempre deja sembrar una base de datos vacía', () => {
    expect(() => assertSeedAllowed({ env: { NODE_ENV: 'production' }, existingPages: 0 })).not.toThrow()
  })

  it('en desarrollo deja volver a sembrar', () => {
    expect(() => assertSeedAllowed({ env: { NODE_ENV: 'development' }, existingPages: 8 })).not.toThrow()
    expect(() => assertSeedAllowed({ env: {}, existingPages: 8 })).not.toThrow()
  })

  it('en producción se niega si ya hay contenido', () => {
    expect(() => assertSeedAllowed({ env: { NODE_ENV: 'production' }, existingPages: 8 })).toThrow(
      /SEED_FORCE=1/,
    )
  })

  it('en producción acepta sustituir el contenido solo si se fuerza', () => {
    expect(() =>
      assertSeedAllowed({ env: { NODE_ENV: 'production', SEED_FORCE: '1' }, existingPages: 8 }),
    ).not.toThrow()
  })
})
