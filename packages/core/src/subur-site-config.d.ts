// La `siteConfig` del client que llegeix el graf de render. El consumidor la hi posa amb
// `turbopack.resolveAlias['subur-site-config']` (Task 10, `withSubur`); vitest, amb l'`alias` de `vitest.config.mts`.
// Es copia a dist; build.ts hi apunta des de dist/types/index.d.ts.
// La forma `import('…')` és la que manté el tipus: un `import type` relatiu dins d'un mòdul ambient és TS2439+TS2307,
// que `skipLibCheck` amaga, i `siteConfig` quedava `any` (D28, D39; sonda S13).
declare module 'subur-site-config' {
  export const siteConfig: import('./utilities/defineSiteConfig.js').SiteConfig
}
