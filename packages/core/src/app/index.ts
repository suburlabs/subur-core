// Les fàbriques de les rutes públiques, `(frontend)` (spec §3.1). Les del grup (subur) són a `./app/admin`: una pàgina
// pública no arrossega el motor del panell ni els seus estils (D29).
export { createSuburAssetsRoute } from './assets.js'
export { createConsentRoute } from './consent.js'
export { createLlmsRoute } from './llms.js'
export { createLocaleLayout } from './localeLayout.js'
export { createNotFound } from './notFound.js'
export { createLocalePage, createSlugPage, type PageArgs } from './pages.js'
export { createPreviewRoutes, type PreviewSearchParams } from './preview.js'
export { createSiteData, type ConfigArg, type SiteData } from './siteData.js'
export { createSitemapRoutes } from './sitemaps.js'
