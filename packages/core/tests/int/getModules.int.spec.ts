import { beforeEach, describe, expect, it, vi } from 'vitest'

import { type ConfigArg, createSiteData } from '../../src/app/siteData.js'

/**
 * `unstable_cache` exigeix l'`incrementalCache` d'una petició real de Next.js
 * («Invariant: incrementalCache missing»): sota Vitest es deixa passar la
 * funció tal qual, i el motor es fingeix com a `health.int.spec.ts`.
 */
const findGlobal = vi.hoisted(() => vi.fn())
/** Els arguments de cada `unstable_cache` (claus i opcions), per comprovar l'etiqueta que el hook caduca. */
const cached = vi.hoisted(() => [] as unknown[][])

vi.mock('next/cache', () => ({
  unstable_cache: <T>(fn: T, ...rest: unknown[]) => {
    cached.push(rest)
    return fn
  },
}))
vi.mock('payload', () => ({ getPayload: async () => ({ findGlobal }) }))

/** La configuració arriba per argument (Task 8): amb el motor fingit, n'hi ha prou amb una qualsevol. */
const { getModules, hasModule } = createSiteData(Promise.resolve({}) as ConfigArg)

describe('getModules', () => {
  beforeEach(() => findGlobal.mockReset())

  it('torna [] si el global no porta modules', async () => {
    findGlobal.mockResolvedValue({ plan: 'business' })
    expect(await getModules()).toEqual([])
    findGlobal.mockResolvedValue({ modules: null, plan: 'business' })
    expect(await getModules()).toEqual([])
  })

  it('torna els ids del global, en ordre', async () => {
    findGlobal.mockResolvedValue({ modules: ['blog', 'ai-visibility'], plan: 'starter' })
    expect(await getModules()).toEqual(['blog', 'ai-visibility'])
    expect(findGlobal).toHaveBeenCalledWith(expect.objectContaining({ depth: 0, slug: 'subscription' }))
  })

  it("es desa amb l'etiqueta global_subscription, la que caduca el hook del global en desar", () => {
    expect(cached).toContainEqual([['subscription-modules'], expect.objectContaining({ tags: ['global_subscription'] })])
  })
})

describe('hasModule', () => {
  beforeEach(() => findGlobal.mockReset())

  it('cert només si el mòdul hi és, sigui quin sigui el pla', async () => {
    findGlobal.mockResolvedValue({ modules: ['ai-visibility'], plan: 'starter' })
    expect(await hasModule('ai-visibility')).toBe(true)
    findGlobal.mockResolvedValue({ modules: ['blog', 'advanced-seo'], plan: 'business' })
    expect(await hasModule('ai-visibility')).toBe(false)
    findGlobal.mockResolvedValue({ plan: 'business' })
    expect(await hasModule('ai-visibility')).toBe(false)
  })
})
