import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Internet Explorer no pot pintar cap web de Subur: va a la pàgina estàtica d'incompatibilitat (si el client la té). */
const IE_REDIRECT = {
  destination: '/ie-incompatible.html',
  has: [{ key: 'user-agent', type: 'header' as const, value: '(.*Trident.*)' }],
  permanent: false,
  source: '/:path((?!ie-incompatible.html$).*)',
}

/** La configuració de Next de tota web de Subur (spec §3.1); el client només hi afegeix el que és seu. */
export function withSubur(nextConfig: NextConfig = {}): NextConfig {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'
  const { hostname, protocol } = new URL(serverUrl)
  // El graf de render llegeix la `siteConfig` del client amb aquest àlies (spec §3.2.2; ruling 1 del spike), relatiu a l'app.
  const siteConfigPath = './src/site/site.config.ts'
  const config: NextConfig = {
    poweredByHeader: false,
    reactStrictMode: true,
    ...nextConfig,
    // Memòria cau persistent (spec §26): el handler desa l'HTML de les rutes i les entrades d'`unstable_cache` al
    // Postgres del client, amb les etiquetes invalidades i la caducitat fora del procés; sobreviu a reinicis i a imatges
    // noves, i és inert durant `next build` i `next dev`. És JS pla del paquet: Next el carrega amb `import()` sense
    // compilar-lo i el traça sol a l'standalone (ruling 4 del spike).
    cacheHandler: fileURLToPath(new URL('../cache/handler.js', import.meta.url)),
    // Amb un handler propi Next no té capa en memòria per a la cau incremental; el 0 només deixa inert el handler per
    // defecte de `'use cache'`, que no es fa servir.
    cacheMaxMemorySize: 0,
    // Set dies: sostre d'antiguitat de l'única resposta antiga que Next pot servir i valor de la capçalera pública
    // `Cache-Control` (cap memòria cau compartida davant l'HTML). Lligat al `revalidate` del layout públic.
    expireTime: 604800,
    output: 'standalone',
    // El backend del consentiment es carrega amb Node en temps d'execució, sense empaquetar: `@standard-community/
    // standard-openapi` ≥ 0.2.11 (via `hono-openapi`) fa `await import('zod-openapi').catch(…)`, i Turbopack fa de
    // l'import opcional sense resoldre un error de build; amb Node, el `catch` funciona. `withPayload` hi afegeix els seus.
    serverExternalPackages: ['@c15t/backend', ...(nextConfig.serverExternalPackages ?? [])],
    // Mentre Next no arregli la resolució de Sass de Turbopack a Windows (vercel/next.js#86431).
    sassOptions: { loadPaths: ['./node_modules/@payloadcms/ui/dist/scss/'], ...nextConfig.sassOptions },
    images: {
      qualities: [100],
      ...nextConfig.images,
      localPatterns: [{ pathname: '/api/media/file/**' }, { pathname: '/site/hero/**' }, ...(nextConfig.images?.localPatterns ?? [])],
      remotePatterns: [{ hostname, protocol: protocol.replace(':', '') as 'http' | 'https' }, ...(nextConfig.images?.remotePatterns ?? [])],
    },
    // El film del hero i els seus pòsters són immutables (si canvien, canvia el nom del fitxer): sense aquesta capçalera,
    // cada navegació de client els tornaria a demanar sencers.
    headers: async () => [
      { headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }], source: '/site/hero/:path*' },
      ...((await nextConfig.headers?.()) ?? []),
    ],
    redirects: async () => [IE_REDIRECT, ...((await nextConfig.redirects?.()) ?? [])],
    // Les carpetes `_` són privades a l'App Router: /_subur/* es serveix per una ruta d'API (spec §3.4).
    rewrites: async () => {
      const own = await nextConfig.rewrites?.()
      const base = [{ destination: '/api/subur-assets/:path*', source: '/_subur/:path*' }]
      if (!own) return base
      return Array.isArray(own) ? [...base, ...own] : { ...own, beforeFiles: [...base, ...(own.beforeFiles ?? [])] }
    },
    // Els assets del paquet (`dist/assets`) no els traça cap import: la ruta que els serveix els hi demana (ruling 3 del spike).
    // La clau és un glob (picomatch amb `contains`) contra la ruta normalitzada: un `[...path]` literal seria una classe
    // de caràcters i no casaria mai. El `package.json` hi va perquè, en copiar a través de l'enllaç de pnpm,
    // `node_modules/@suburlabs/core` passa a ser un directori real amb només el que s'inclou: sense ell, la ruta no podria
    // resoldre el paquet des de `process.cwd()` i respondria 404.
    outputFileTracingIncludes: {
      ...nextConfig.outputFileTracingIncludes,
      '/api/subur-assets/**': ['./node_modules/@suburlabs/core/dist/assets/**/*', './node_modules/@suburlabs/core/package.json'],
    },
    turbopack: {
      root: process.cwd(),
      ...nextConfig.turbopack,
      resolveAlias: { ...nextConfig.turbopack?.resolveAlias, 'subur-site-config': siteConfigPath },
    },
    // Només per a `next build --webpack`: amb `turbopack` present, Next ignora aquesta funció.
    webpack: (webpackConfig, context) => {
      webpackConfig.resolve.alias = { ...webpackConfig.resolve.alias, 'subur-site-config': path.resolve(process.cwd(), siteConfigPath) }
      return nextConfig.webpack ? nextConfig.webpack(webpackConfig, context) : webpackConfig
    },
  }
  return withPayload(config, { devBundleServerPackages: false })
}
