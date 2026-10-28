import { describe, expect, it } from 'vitest'

import { uiKeys } from '../../src/i18n/uiDefaults.js'
import { seedUiOverrides } from '../../src/seed/uiOverrides.js'

describe('seedUiOverrides', () => {
  it('devuelve todas las claves de uiKeys, sin ninguna extra', () => {
    const result = seedUiOverrides()
    expect(Object.keys(result).sort()).toEqual([...uiKeys].sort())
  })

  it('pone a null las claves que el cliente no sobreescribe', () => {
    const result = seedUiOverrides()
    for (const key of uiKeys) {
      expect(result[key]).toBeNull()
    }
  })

  it('conserva el valor que el cliente sí sobreescribe', () => {
    const result = seedUiOverrides({ callUs: 'Trucar ara' })
    expect(result.callUs).toBe('Trucar ara')
  })

  it('pone a null el resto de claves cuando solo una está sobreescrita', () => {
    const result = seedUiOverrides({ callUs: 'Trucar ara' })
    for (const key of uiKeys) {
      if (key === 'callUs') continue
      expect(result[key]).toBeNull()
    }
  })

  it('trata undefined igual que no pasar el objeto', () => {
    expect(seedUiOverrides(undefined)).toEqual(seedUiOverrides())
  })
})
