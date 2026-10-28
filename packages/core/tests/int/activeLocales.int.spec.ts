import { describe, expect, it, vi } from 'vitest'

import { sortActiveLocales } from '../../src/i18n/activeLocalesOrder.js'
import { filterAdminLocales } from '../../src/i18n/filterAdminLocales.js'

describe('sortActiveLocales', () => {
  it('pone el idioma por defecto primero y el resto en orden de catálogo', () => {
    expect(sortActiveLocales(['en', 'es', 'ca'], 'es')).toEqual(['es', 'ca', 'en'])
    expect(sortActiveLocales(['en', 'es'], 'es')).toEqual(['es', 'en'])
  })

  it('incluye siempre el idioma por defecto e ignora códigos desconocidos', () => {
    expect(sortActiveLocales(['en'], 'es')).toEqual(['es', 'en'])
    expect(sortActiveLocales(['fr', 'ca'], 'es')).toEqual(['es', 'ca'])
    expect(sortActiveLocales([], 'es')).toEqual(['es'])
  })
})

describe('filterAdminLocales', () => {
  const all = [
    { code: 'es', label: 'Español' },
    { code: 'ca', label: 'Català' },
    { code: 'en', label: 'English' },
  ]
  const req = (role: string) => ({
    payload: { findGlobal: vi.fn().mockResolvedValue({ activeLocales: ['es', 'ca'] }) },
    user: { role },
  })

  it('el superadministrador ve el catálogo entero', async () => {
    expect(await filterAdminLocales({ locales: all, req: req('superadmin') } as never)).toEqual(all)
  })

  it('el administrador solo ve los idiomas activos', async () => {
    const result = await filterAdminLocales({ locales: all, req: req('admin') } as never)
    expect(result.map(({ code }) => code)).toEqual(['es', 'ca'])
  })
})
