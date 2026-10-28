import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Intern del paquet, pel camí de font del workspace (regla de les proves de la demo, Task 16; D56)
import { CACHE_REVALIDATE_SECONDS } from '../../../../packages/core/src/utilities/cacheRevalidate.js'
import nextConfig from '../../next.config'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const localeRoutes = path.join('src', 'app', '(frontend)', '[locale]')
const routeFiles = walk(localeRoutes).filter((file) => /\.tsx?$/.test(file))
const read = (file: string) => readFileSync(file, 'utf8')

/**
 * Els comentaris parlen de les banderes i de les crides que precisament no
 * s'han de fer servir, així que cap guardià no els ha de llegir.
 */
const readWithoutComments = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')

/**
 * Les pàgines públiques es generen a la primera visita i queden en memòria
 * cau fins que el CMS les invalida. Next renderitza `not-found.tsx` amb cada
 * pàgina, de manera que una sola lectura de `headers()`/`cookies()` en
 * qualsevol fitxer d'aquest subarbre fa fallar totes les rutes amb «Page
 * changed from static to dynamic at runtime» (el 500 del 2026-09-19).
 */
describe('public routes stay statically cacheable', () => {
  it('never reads request headers or cookies under [locale]', () => {
    const offenders = routeFiles.filter((file) =>
      /import\s*\{[^}]*\b(cookies|headers)\b[^}]*\}\s*from\s*'next\/headers'/.test(read(file)),
    )
    expect(offenders).toEqual([])
  })

  it('never forces dynamic rendering under [locale]', () => {
    const offenders = routeFiles.filter((file) => /force-dynamic/.test(read(file)))
    expect(offenders).toEqual([])
  })

  it('opts the layout and the page into on-demand static generation', () => {
    for (const file of ['layout.tsx', path.join('[slug]', 'page.tsx')]) {
      expect(read(path.join(localeRoutes, file))).toMatch(/export function generateStaticParams\(/)
    }
  })
})

/**
 * El 2026-09-24, amb la base de dades ja canviada, `/es` i `/en` servien el
 * graf de dades estructurades antic i `/ca` en servia un de més vell encara: un
 * fitxer per idioma a `.next/server/app/`. Next 16.3 desa la invalidació
 * d'etiquetes en un `Map` de mòdul que no persisteix (`tags-manifest.external`),
 * i una entrada només cau si la invalidació és posterior a la seva data; l'HTML
 * i les entrades d'`unstable_cache`, en canvi, van al disc del contenidor.
 *
 * La primera correcció del mateix dia treia l'escriptura al disc
 * (`isrFlushToDisk: false`), però aquella bandera també governa la cau al disc
 * de l'optimitzador d'imatges i cada `/_next/image` va passar a costar 1–1,7 s
 * al VPS. Reconciliació: la cau al disc torna (imatges incloses) i, des del pla
 * K2 (spec §26), la cau de rutes i de dades viu al Postgres del client amb la
 * invalidació fora del procés; el termini d'un dia només és una xarxa de
 * seguretat. Aquests guardians fixen la configuració que ho fa possible.
 *
 * A la demo, la meitat de les rutes de la prova: les crides d'`unstable_cache` i el hook únic d'invalidació són de
 * `src/` del paquet i les prova el paquet (`staticRendering.int.spec.ts`); el `src/` propi de la demo, al final.
 */
describe('the public route cache cannot outlive its invalidation', () => {
  it('leaves the image optimizer disk cache enabled', () => {
    expect(readWithoutComments('next.config.ts')).not.toMatch(/isrFlushToDisk/)
    expect(nextConfig).not.toHaveProperty('experimental.isrFlushToDisk')
  })

  // A la demo, `next.config.ts` és `withSubur(…)`: la configuració de la cau la posa el paquet, i aquí es mira la que
  // en resulta (el text de `withSubur` el fixa `withSubur.int.spec.ts` del paquet).
  it('routes the incremental cache through the persistent handler', () => {
    const config = readWithoutComments('next.config.ts')
    expect(config).toMatch(/export default withSubur\(/)
    expect(nextConfig.cacheHandler).toMatch(/[/\\]cache[/\\]handler\.js$/)
    expect(existsSync(nextConfig.cacheHandler!)).toBe(true)
    expect(nextConfig.cacheMaxMemorySize).toBe(0)
    expect(config).not.toMatch(/customCacheHandler/)
  })

  it('caps how old a cached public page can get', () => {
    const match = read(path.join(localeRoutes, 'layout.tsx')).match(
      /export const revalidate = (\d+)/,
    )
    expect(match).not.toBeNull()
    expect(Number(match![1])).toBe(CACHE_REVALIDATE_SECONDS)
  })

  /**
   * El sostre del `revalidate` només val el que valgui `expireTime`: sense ell,
   * Next hi posa un any i, passat el `revalidate`, tornaria a servir l'entrada
   * antiga tantes vegades com calgués (i ho anunciaria a `Cache-Control`). Els
   * dos números van junts i cap dels altres tests no els lligava.
   */
  it('bounds the stale-while-revalidate window above that cap', () => {
    expect(nextConfig.expireTime).toBe(604800)

    const revalidate = Number(
      read(path.join(localeRoutes, 'layout.tsx')).match(/export const revalidate = (\d+)/)![1],
    )
    const expireTime = nextConfig.expireTime!
    expect(expireTime).toBeGreaterThan(revalidate)
  })
})

/**
 * Les mateixes dues guardes sobre el `src/` propi de la demo: cada crida d'`unstable_cache` porta etiqueta i sostre, i
 * cap fitxer importa una invalidació de `next/cache` (l'única invalidació és el hook del paquet). Avui la demo no en té
 * cap crida: una de nova ha de passar per aquí i aquesta prova s'ha de revisar.
 */
describe('the demo source caches and invalidates only through the package', () => {
  const demoSources = walk('src')
    .filter((file) => /\.(tsx?|jsx?|mjs)$/.test(file))
    .map((file) => [file, readWithoutComments(file)] as const)

  it('caps every unstable_cache call under the demo src (today, none)', () => {
    const withCalls = demoSources.filter(([, source]) => /\bunstable_cache\(/.test(source))
    for (const [file, source] of withCalls) {
      const calls = (source.match(/\bunstable_cache\(/g) ?? []).length
      const tagged = (source.match(/tags:\s*\[/g) ?? []).length
      const capped = (source.match(/revalidate:\s*CACHE_REVALIDATE_SECONDS/g) ?? []).length
      expect(tagged, `${file}: ${calls} unstable_cache call(s), ${tagged} tagged`).toBe(calls)
      expect(capped, `${file}: ${calls} unstable_cache call(s), ${capped} with a ceiling`).toBe(calls)
    }
    expect(withCalls.map(([file]) => file)).toEqual([])
  })

  it('no file under the demo src imports an invalidation call from next/cache', () => {
    const offenders = demoSources
      .filter(([file]) => /import\s*\{[^}]*\b(revalidateTag|revalidatePath|updateTag)\b[^}]*\}\s*from\s*'next\/cache'/.test(read(file)))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })
})
