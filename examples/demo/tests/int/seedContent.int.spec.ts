import { describe, expect, it } from 'vitest'

// Interns del paquet, pel camí de font del workspace (regla de les proves de la demo, Task 16; D56)
import type { SeedRefs } from '../../../../packages/core/src/seed/types.js'
import { defaultLocaleOf } from '../../../../packages/core/src/site/index.js'
import { content, type PageSlug, pageSlugs } from '../../src/site/seed/content'
import { type MediaKey, mediaKeys } from '../../src/site/seed/media'
import { siteConfig } from '../../src/site/site.config'

// A la demo, el contingut de cada idioma és `content.byLocale` i la referència és l'idioma per defecte de la demo (ca):
// el que a l'arrel es diu «el castellà» aquí és `seedContent[base]`.
const seedContent = content.byLocale
const base = defaultLocaleOf(siteConfig)
type Refs = SeedRefs<PageSlug, MediaKey>

const INVARIANT_KEYS = new Set([
  'blockType',
  'columns',
  'confirmationType',
  'defaultValue',
  'email',
  'emailTo',
  'form',
  'icon',
  'moment',
  'name',
  'newTab',
  'page',
  'phone',
  'platform',
  'relationTo',
  'replyTo',
  'required',
  'slug',
  'type',
  'url',
  'value',
  'variant',
  'width',
])

const refs: Refs = {
  formId: 1,
  media: Object.fromEntries(
    mediaKeys.map((key, index) => [key, index + 100]),
  ) as Refs['media'],
  pages: Object.fromEntries(
    pageSlugs.map((slug, index) => [slug, index + 10]),
  ) as Refs['pages'],
}

type Mismatch = { path: string; problem: string }

// The three node shapes that legitimately carry an es-only `image` key
// (see Task 4 of Plan C: `image` is not localized, so translations omit it
// and `mergeLocalized` keeps the Spanish value).
// (A la demo, «Spanish»/`es` en aquests comentaris vol dir el build de l'idioma per defecte, `ca`.)
// Observed real `path` values at these nodes, from an actual failing run before this exception existed:
//   pageHero block:      "build.pages.contacte.layout[0]"        (es.blockType === 'pageHero')
//   servicesGrid item:   "build.pages.home.layout[1].items[0]"   (path ends in `.items[<n>]`)
//   statement block:     "build.pages.serveis.layout[1]"    (es.blockType === 'statement')
//
// A path ending in `.items[<n>]` is NOT enough on its own to identify a
// servicesGrid item: `featureList` and `taskCatalog` blocks also have an
// `items`/`groups` array (see src/site/seed/content/ca.ts's featureList
// blocks), so an item's own path shape is ambiguous — the same
// `.items[<n>]` suffix appears under every block that names its array
// `items`. The array element itself carries no `blockType` (that lives on
// its parent, the block object one level up), so identifying "which block
// is this item inside" requires the enclosing block type, threaded down
// through the recursion as `parentBlockType`.
const isPageHeroBlock = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  (value as Record<string, unknown>).blockType === 'pageHero'

const isStatementBlock = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  (value as Record<string, unknown>).blockType === 'statement'

const isServicesGridItem = (path: string, parentBlockType: string | undefined): boolean =>
  parentBlockType === 'servicesGrid' && /\.items\[\d+\]$/.test(path)

// A scene of the home hero: `beats[<n>].image` is the per-scene photo, also
// not localized.
const isScrollHeroBeat = (path: string, parentBlockType: string | undefined): boolean =>
  parentBlockType === 'scrollHero' && /\.beats\[\d+\]$/.test(path)

// Same situation as `image`, on `siteSettings` (Task 4 of Plan H1):
// `googleBusinessProfile` and every scalar of `location` except `areaServed`
// are NOT localized, so only the Spanish build carries them and `ca`/`en`
// keep the Spanish value through `mergeLocalized`. `location.areaServed` IS
// localized and therefore must appear in every locale.
//
// Keyed by the exact node path and matched against the exact sorted set of
// es-only keys: a missing `areaServed`, a stray extra key, or the same keys
// appearing at any other node all still fail this check.
const NON_LOCALIZED_ES_ONLY_KEYS: Record<string, string> = {
  'build.siteSettings': 'googleBusinessProfile',
  'build.siteSettings.location':
    'addressCountry,addressLocality,addressRegion,geo,postalCode,streetAddress',
}

function compare(
  es: unknown,
  other: unknown,
  path: string,
  mismatches: Mismatch[],
  parentBlockType?: string,
) {
  if (Array.isArray(es)) {
    if (!Array.isArray(other) || other.length !== es.length) {
      mismatches.push({ path, problem: 'array length differs' })
      return
    }
    es.forEach((item, index) =>
      compare(item, other[index], `${path}[${index}]`, mismatches, parentBlockType),
    )
    return
  }

  if (typeof es === 'object' && es !== null) {
    if (typeof other !== 'object' || other === null) {
      mismatches.push({ path, problem: 'object missing' })
      return
    }
    if ('root' in es) return
    const esKeys = Object.keys(es).sort()
    const otherKeys = Object.keys(other).sort()
    const ownBlockType =
      typeof (es as Record<string, unknown>).blockType === 'string'
        ? ((es as Record<string, unknown>).blockType as string)
        : undefined
    const childBlockType = ownBlockType ?? parentBlockType
    if (esKeys.join() !== otherKeys.join()) {
      // `image` is not a localized field: it only appears on the Spanish
      // build, and translations keep the Spanish value via mergeLocalized.
      // Scoped to the two node shapes that actually carry it, so a stray
      // `image` key anywhere else in the tree still fails this check.
      const esOnly = esKeys.filter((key) => !otherKeys.includes(key))
      const otherOnly = otherKeys.filter((key) => !esKeys.includes(key))
      const isImageOnlyDiff =
        esOnly.join() === 'image' &&
        otherOnly.length === 0 &&
        (isPageHeroBlock(es) ||
          isStatementBlock(es) ||
          isServicesGridItem(path, parentBlockType) ||
          isScrollHeroBeat(path, parentBlockType))
      const isNonLocalizedOnlyDiff =
        otherOnly.length === 0 && NON_LOCALIZED_ES_ONLY_KEYS[path] === esOnly.join()
      if (!isImageOnlyDiff && !isNonLocalizedOnlyDiff) {
        mismatches.push({ path, problem: `keys differ: ${esKeys} vs ${otherKeys}` })
        return
      }
    }
    for (const key of esKeys.filter((key) => otherKeys.includes(key))) {
      const esValue = (es as Record<string, unknown>)[key]
      const otherValue = (other as Record<string, unknown>)[key]
      if (INVARIANT_KEYS.has(key) && typeof esValue !== 'object') {
        if (esValue !== otherValue)
          mismatches.push({ path: `${path}.${key}`, problem: 'must not be translated' })
      } else {
        compare(esValue, otherValue, `${path}.${key}`, mismatches, childBlockType)
      }
    }
    return
  }

  if (typeof es !== typeof other) mismatches.push({ path, problem: 'type differs' })
}

describe.each((['ca', 'en', 'es'] as const).filter((l) => l !== base))('seed content %s', (locale) => {
  it('has the same structure as the default locale', () => {
    const mismatches: Mismatch[] = []
    const content = seedContent[locale]
    expect(content).toBeDefined()
    compare(seedContent[base]!.form, content!.form, 'form', mismatches)
    compare(seedContent[base]!.build(refs), content!.build(refs), 'build', mismatches)
    expect(mismatches).toEqual([])
  })

  it('is actually translated', () => {
    const esTitle = seedContent[base]!.build(refs).pages.home.layout![1]
    const otherTitle = seedContent[locale]!.build(refs).pages.home.layout![1]
    expect(otherTitle).not.toEqual(esTitle)
  })
})

describe('compare() es-only "image" key exception', () => {
  it('tolerates it on a pageHero block', () => {
    const mismatches: Mismatch[] = []
    compare(
      { blockType: 'pageHero', heading: 'Título', image: 42, lead: 'Texto' },
      { blockType: 'pageHero', heading: 'Title', lead: 'Text' },
      'build.pages.contacte.layout[0]',
      mismatches,
    )
    expect(mismatches).toEqual([])
  })

  it('tolerates it on a servicesGrid item', () => {
    const mismatches: Mismatch[] = []
    compare(
      { image: 1, page: 10, summary: 'Resumen', tagline: 'Eslogan', title: 'Título' },
      { page: 10, summary: 'Summary', tagline: 'Tagline', title: 'Title' },
      'build.pages.home.layout[2].items[0]',
      mismatches,
      'servicesGrid',
    )
    expect(mismatches).toEqual([])
  })

  it('tolerates it on a statement block', () => {
    const mismatches: Mismatch[] = []
    compare(
      { blockType: 'statement', image: 1, text: 'Texto' },
      { blockType: 'statement', text: 'Text' },
      'build.pages.serveis.layout[1]',
      mismatches,
    )
    expect(mismatches).toEqual([])
  })

  it('tolerates it on a scrollHero beat, reached through the recursion', () => {
    const mismatches: Mismatch[] = []
    compare(
      { beats: [{ heading: 'Título', image: 1, label: 'Escena' }], blockType: 'scrollHero' },
      { beats: [{ heading: 'Title', label: 'Scene' }], blockType: 'scrollHero' },
      'build.pages.home.layout[0]',
      mismatches,
    )
    expect(mismatches).toEqual([])
  })

  it('still flags it anywhere else in the tree', () => {
    const mismatches: Mismatch[] = []
    compare(
      { blockType: 'ctaBand', image: 1, text: 'Texto' },
      { blockType: 'ctaBand', text: 'Text' },
      'build.pages.home.layout[5]',
      mismatches,
    )
    expect(mismatches).toEqual([
      {
        path: 'build.pages.home.layout[5]',
        problem: 'keys differ: blockType,image,text vs blockType,text',
      },
    ])
  })

  it('still flags it on a featureList item, even though the path also ends in .items[<n>]', () => {
    const mismatches: Mismatch[] = []
    compare(
      { icon: 'house', image: 1, text: 'Texto', title: 'Título' },
      { icon: 'house', text: 'Text', title: 'Title' },
      'build.pages.home.layout[3].items[0]',
      mismatches,
      'featureList',
    )
    expect(mismatches).toEqual([
      {
        path: 'build.pages.home.layout[3].items[0]',
        problem: 'keys differ: icon,image,text,title vs icon,text,title',
      },
    ])
  })

  it('threads the enclosing blockType through compare() itself, not just via the call-site stub', () => {
    // Exercises the actual recursion path (object -> items array -> item),
    // not a hand-supplied parentBlockType, so it proves compare() computes
    // and propagates childBlockType correctly on its own.
    const mismatches: Mismatch[] = []
    compare(
      {
        blockType: 'servicesGrid',
        heading: 'Servicios',
        items: [{ image: 1, page: 10, summary: 'Resumen', tagline: 'Eslogan', title: 'Título' }],
      },
      {
        blockType: 'servicesGrid',
        heading: 'Services',
        items: [{ page: 10, summary: 'Summary', tagline: 'Tagline', title: 'Title' }],
      },
      'build.pages.home.layout[2]',
      mismatches,
    )
    expect(mismatches).toEqual([])

    const featureListMismatches: Mismatch[] = []
    compare(
      {
        blockType: 'featureList',
        heading: 'Control',
        items: [{ icon: 'house', image: 1, text: 'Texto', title: 'Título' }],
      },
      {
        blockType: 'featureList',
        heading: 'Quality',
        items: [{ icon: 'house', text: 'Text', title: 'Title' }],
      },
      'build.pages.home.layout[3]',
      featureListMismatches,
    )
    expect(featureListMismatches).toEqual([
      {
        path: 'build.pages.home.layout[3].items[0]',
        problem: 'keys differ: icon,image,text,title vs icon,text,title',
      },
    ])
  })
})
