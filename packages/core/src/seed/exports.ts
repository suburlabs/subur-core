/**
 * `@suburlabs/core/seed` (spec §3.5): el motor del seed. El contingut (pàgines,
 * formulari, globals, imatges) és del client; el motor el sembra en l'ordre
 * d'idiomes del seu `siteConfig` i no en crea cap bloc desactivat.
 */
export { flushSiteCacheAfterSeed, runSeed } from './index.js'
export { heroPhotos } from './heroPhotos.js'
export { heading, pageLink, paragraph, richText, urlLink } from './helpers.js'
export type { FormInput, PageInput, SeedBuild, SeedContent, SeedLocaleContent, SeedMedia, SeedRefs } from './types.js'
export { uiKeys, type UiKey } from '../i18n/uiDefaults.js'
