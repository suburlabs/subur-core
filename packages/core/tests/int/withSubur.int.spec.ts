// @vitest-environment node
// El `next.config` del client corre amb Node pla. Sota jsdom, Vite treballa en mode web i reescriu
// `new URL('<literal>', import.meta.url)` com a URL d'asset (`http://localhost:3000/…`), que `fileURLToPath` rebutja.
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import { withSubur } from '../../src/next/index.js'

// Les mateixes peces amb què Next aplica `outputFileTracingIncludes` (`build/collect-build-traces.js`).
const require = createRequire(import.meta.url)
const picomatch = require('next/dist/compiled/picomatch') as (glob: string, options: { contains: boolean; dot: boolean }) => (input: string) => boolean
const { normalizeAppPath } = require('next/dist/shared/lib/router/utils/app-paths') as { normalizeAppPath: (route: string) => string }
const ASSETS_ENTRIES = ['app/api/subur-assets/[...path]/route', 'app/(frontend)/api/subur-assets/[...path]/route']
const matches = (key: string, entry: string) => picomatch(key, { contains: true, dot: true })(normalizeAppPath(entry))

describe('withSubur (spec §3.1 ./next)', () => {
  it('fixa la cau persistent, standalone i l\'expiració', () => {
    const c = withSubur({})
    expect(c.cacheMaxMemorySize).toBe(0)
    expect(c.expireTime).toBe(604800)
    expect(c.output).toBe('standalone')
  })
  it('des de dist, el cacheHandler apunta a un fitxer que existeix al paquet', async () => {
    const { withSubur: built } = await import('@suburlabs/core/next')
    const handler = built({}).cacheHandler!
    expect(handler).toMatch(/dist[\\/]cache[\\/]handler\.js$/)
    expect(existsSync(handler)).toBe(true)
  })
  it('l\'àlies subur-site-config apunta al site.config.ts del client', () => {
    expect(withSubur({}).turbopack?.resolveAlias?.['subur-site-config']).toBe('./src/site/site.config.ts')
  })
  it('conserva el que el client hi posa', () => {
    const c = withSubur({ allowedDevOrigins: ['10.*.*.*'], turbopack: { root: '/ws' } })
    expect(c.turbopack?.root).toBe('/ws')
    expect(c.allowedDevOrigins).toEqual(['10.*.*.*'])
  })
  it('carrega el backend del consentiment sense empaquetar i conserva els externs del client', () => {
    // Empaquetat, `standard-openapi` ≥ 0.2.11 trenca el build de Turbopack («Can't resolve 'zod-openapi'»).
    expect(withSubur({}).serverExternalPackages).toContain('@c15t/backend')
    const c = withSubur({ serverExternalPackages: ['client-extern'] })
    expect(c.serverExternalPackages).toEqual(expect.arrayContaining(['@c15t/backend', 'client-extern']))
  })
  it('reescriu /_subur/* a la ruta dels assets del paquet', async () => {
    expect(await withSubur({}).rewrites!()).toEqual([{ destination: '/api/subur-assets/:path*', source: '/_subur/:path*' }])
  })
  it('traça dist/assets i el package.json del paquet a l\'standalone', () => {
    // El package.json: copiat a través de l'enllaç de pnpm, `node_modules/@suburlabs/core` és un directori real amb només
    // el que s'inclou, i sense ell la ruta dels assets no resol el paquet des de `process.cwd()`.
    expect(withSubur({}).outputFileTracingIncludes?.['/api/subur-assets/**']).toEqual([
      './node_modules/@suburlabs/core/dist/assets/**/*',
      './node_modules/@suburlabs/core/package.json',
    ])
  })
  it('la clau dels includes casa amb la ruta dels assets tal com la normalitza Next (un `[...path]` literal, no)', () => {
    // Només les claus que porten els assets: withPayload hi afegeix `**/*`, que casa amb tot.
    const keys = Object.entries(withSubur({}).outputFileTracingIncludes ?? {})
      .filter(([, includes]) => includes.some((include) => include.includes('@suburlabs/core/dist/assets')))
      .map(([key]) => key)
    expect(keys).toHaveLength(1)
    for (const entry of ASSETS_ENTRIES) {
      expect(keys.some((key) => matches(key, entry)), entry).toBe(true)
      expect(matches('/api/subur-assets/[...path]', entry), entry).toBe(false)
    }
  })
  it('capçaleres immutables de /site/hero i patrons d\'imatge locals', async () => {
    const c = withSubur({})
    expect(JSON.stringify(await c.headers!())).toContain('/site/hero/:path*')
    expect(c.images?.localPatterns?.map((p) => p.pathname)).toEqual(['/api/media/file/**', '/site/hero/**'])
  })
})
