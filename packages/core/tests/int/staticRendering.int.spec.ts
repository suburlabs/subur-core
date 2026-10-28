import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { CACHE_REVALIDATE_SECONDS } from '../../src/utilities/cacheRevalidate.js'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

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
 * Al paquet, la meitat de `src/` de la prova (Task 16): el que diu de les rutes (`[locale]`), del layout i de
 * `next.config.ts` és de cada app i ho prova la demo; `cacheHandler`, `cacheMaxMemorySize` i `expireTime` els fixa
 * `withSubur` (`withSubur.int.spec.ts`).
 */
describe('the public route cache cannot outlive its invalidation', () => {
  /**
   * Les entrades d'`unstable_cache` són l'altra capa que va anar al disc i que
   * es va quedar sense la seva invalidació: sense `revalidate`, Next hi desa
   * `CACHE_ONE_YEAR_SECONDS` (`unstable-cache.js`) i l'etiqueta és l'únic que
   * les pot descartar —i, per a les entrades de dades, l'etiqueta sí que es
   * comprova sempre (`incremental-cache/index.js`, branca `FETCH`). Mesurat a
   * l'entrada de `global_subscription`, que la llista de tres llocs de crida del
   * pla no incloïa: per això el guardià recorre **tots** els llocs de crida de
   * `src`, no una llista escrita a mà, i compta crides i no opcions.
   */
  it('caps every unstable_cache call under src', () => {
    expect(CACHE_REVALIDATE_SECONDS).toBe(86400)

    const sources = walk('src')
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => [file, readWithoutComments(file)] as const)
      .filter(([, source]) => /\bunstable_cache\(/.test(source))

    // Al paquet, els llocs de crida són tres fitxers (`app/siteData.ts`, `app/sitemaps.ts`, `app/llms.ts`).
    expect(sources.length).toBeGreaterThanOrEqual(3)

    for (const [file, source] of sources) {
      // Es compten les CRIDES, no les opcions: comparar `tags:` amb
      // `revalidate:` deixava passar una crida nova sense cap de les dues en un
      // fitxer que ja en tingués una de correcta.
      const calls = (source.match(/\bunstable_cache\(/g) ?? []).length
      const tagged = (source.match(/tags:\s*\[/g) ?? []).length
      const capped = (source.match(/revalidate:\s*CACHE_REVALIDATE_SECONDS/g) ?? []).length

      expect(tagged, `${file}: ${calls} unstable_cache call(s), ${tagged} tagged`).toBe(calls)
      expect(capped, `${file}: ${calls} unstable_cache call(s), ${capped} with a ceiling`).toBe(calls)
    }
  })
})

/**
 * `revalidateTag(tag, 'max')` serveix el contingut antic a la visita següent
 * mentre es regenera: qui acaba de desar al CMS recarrega i no veu el seu
 * canvi. El que edita una persona ha de caducar a l'instant. Des del pla K2
 * (spec §26.4) un sol hook invalida tot l'arbre amb `'*'`, i és l'únic lloc de
 * `src` que pot invalidar: un hook per document nou tornaria a deixar fora les
 * dependències entre documents.
 */
describe('editor-facing revalidation is immediate', () => {
  const hook = path.join('src', 'hooks', 'invalidateSiteCache.ts')
  const retired = [
    path.join('src', 'Header', 'hooks', 'revalidateHeader.ts'),
    path.join('src', 'Footer', 'hooks', 'revalidateFooter.ts'),
    path.join('src', 'SiteSettings', 'hooks', 'revalidateSiteSettings.ts'),
    path.join('src', 'Subscription', 'hooks', 'revalidateSubscription.ts'),
    path.join('src', 'hooks', 'revalidateRedirects.ts'),
    path.join('src', 'collections', 'Pages', 'hooks', 'revalidatePage.ts'),
  ]

  it('the single hook expires the whole tree without a stale window', () => {
    expect(existsSync(hook)).toBe(true)
    expect(readWithoutComments(hook)).toContain('revalidateTag(CACHE_ALL_TAG, { expire: 0 })')
  })

  it.each(retired)('%s is gone', (file) => {
    expect(existsSync(file)).toBe(false)
  })

  it('no other file under src imports an invalidation call from next/cache', () => {
    // Mira importacions, no crides: el handler defineix un mètode `revalidateTag`
    // propi, i `unstable_cache` sí que es pot importar.
    const offenders = walk('src')
      .filter((file) => /\.(tsx?|jsx?|mjs)$/.test(file) && file !== hook)
      .filter((file) =>
        /import\s*\{[^}]*\b(revalidateTag|revalidatePath|updateTag)\b[^}]*\}\s*from\s*'next\/cache'/.test(read(file)),
      )
    expect(offenders).toEqual([])
  })
})
