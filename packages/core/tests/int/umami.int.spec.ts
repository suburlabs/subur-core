import { afterEach, describe, expect, it, vi } from 'vitest'

import { umamiConfig, umamiScripts } from '../../src/analytics/umami.js'

const full = {
  NEXT_PUBLIC_UMAMI_SCRIPT_URL: 'https://analytics.subur.dev/script.js',
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
}

describe('umamiConfig', () => {
  it('sin variables: sin analítica', () => {
    expect(umamiConfig({})).toBeNull()
    expect(umamiScripts({})).toEqual([])
  })

  it('con las dos: configuración y un script en la categoría measurement', () => {
    expect(umamiConfig(full)).toEqual({ scriptUrl: full.NEXT_PUBLIC_UMAMI_SCRIPT_URL, websiteId: full.NEXT_PUBLIC_UMAMI_WEBSITE_ID })
    const [script] = umamiScripts(full)
    expect(script).toBeDefined()
    expect(JSON.stringify(script)).toContain('measurement')
    expect(JSON.stringify(script)).toContain(full.NEXT_PUBLIC_UMAMI_WEBSITE_ID)
    expect(JSON.stringify(script)).toContain(full.NEXT_PUBLIC_UMAMI_SCRIPT_URL)
  })

  it('con una sola: falla y dice cuál falta', () => {
    expect(() => umamiConfig({ NEXT_PUBLIC_UMAMI_WEBSITE_ID: 'x' })).toThrow(/NEXT_PUBLIC_UMAMI_SCRIPT_URL/)
  })

  it('un valor en blanco cuenta como ausente', () => {
    expect(() => umamiConfig({ ...full, NEXT_PUBLIC_UMAMI_WEBSITE_ID: '  ' })).toThrow(/NEXT_PUBLIC_UMAMI_WEBSITE_ID/)
  })

  it('script sin esquema: lanza con el mensaje de URL inválida', () => {
    expect(() =>
      umamiConfig({ ...full, NEXT_PUBLIC_UMAMI_SCRIPT_URL: 'analytics.subur.dev/script.js' }),
    ).toThrow('Umami: NEXT_PUBLIC_UMAMI_SCRIPT_URL no es una URL válida')
  })

  it('script con esquema ftp: lanza (solo http/https)', () => {
    expect(() =>
      umamiConfig({ ...full, NEXT_PUBLIC_UMAMI_SCRIPT_URL: 'ftp://analytics.subur.dev/script.js' }),
    ).toThrow('Umami: NEXT_PUBLIC_UMAMI_SCRIPT_URL no es una URL válida')
  })

  it('script https válido: ok', () => {
    expect(() => umamiConfig(full)).not.toThrow()
  })
})

/**
 * R4 (ruling del coordinador, Tasca 3 del Pla H2): `umamiConfig(process.env)`
 * es crida com a sentència solta a `src/plugins/index.ts`, abans de
 * `export const plugins`, NOMÉS pel seu efecte de llançar — no es fa servir
 * el seu valor de retorn (igual que `s3Config` ho fa dins `s3Storage()`, però
 * allà el retorn SÍ s'utilitza, cosa que fa aquella crida evidentment
 * necessària a ull; aquí no ho és, i una refactorització futura la podria
 * esborrar sense que cap prova ho detectés). Aquesta prova tanca aquest
 * forat: carrega el mòdul de debò (el mateix que `src/payload.config.ts`
 * importa, i que corre tant a `next build` com a l'arrencada del servidor,
 * vegeu l'informe de la Tasca 3) amb un entorn a mig configurar i comprova
 * que la càrrega falla amb el nom de la variable que falta.
 *
 * `vi.resetModules()` buida la memòria cau de mòduls perquè el `import()`
 * següent torni a executar el cos de `src/plugins/index.ts` (i per tant la
 * crida a `umamiConfig`) amb l'entorn ja mutat; sense això, un `import()`
 * repetit tornaria la mateixa instància ja carregada la primera vegada que
 * es va important aquest fitxer de prova. `vi.stubEnv(..., undefined)`
 * esborra la variable de l'entorn del procés (no la deixa en blanc), i
 * `afterEach` la restaura amb `vi.unstubAllEnvs()` perquè cap altra prova
 * d'aquest fitxer (ni de cap altre: vitest aïlla el registre de mòduls per
 * fitxer) quedi afectada.
 */
describe('umamiConfig al carregar @/plugins (R4: falla en arrencar/construir, no en cada render)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('amb només una variable: carregar @/plugins llança i diu quina falta', async () => {
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', 'x')
    vi.stubEnv('NEXT_PUBLIC_UMAMI_SCRIPT_URL', undefined)
    vi.resetModules()
    await expect(import('../../src/plugins/index.js')).rejects.toThrow(/NEXT_PUBLIC_UMAMI_SCRIPT_URL/)
  })

  it('sin variables: cargar @/plugins no lanza', async () => {
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', undefined)
    vi.stubEnv('NEXT_PUBLIC_UMAMI_SCRIPT_URL', undefined)
    vi.resetModules()
    await expect(import('../../src/plugins/index.js')).resolves.toHaveProperty('plugins')
  })
})
