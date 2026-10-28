import react from '@vitejs/plugin-react'
import path from 'node:path'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  // El graf de render del paquet llegeix la `siteConfig` de l'app amb aquest àlies, com fa `withSubur` a Next.
  resolve: { alias: { 'subur-site-config': path.resolve('src/site/site.config.ts') } },
  test: {
    environment: 'jsdom',
    fileParallelism: false,
    globalSetup: ['./tests/globalSetup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    setupFiles: ['./tests/vitest.setup.ts'],
    // El motor (vistes i layouts del panell) i c15t no es poden carregar amb Node sota vitest: CSS dins de
    // react-image-crop i `next/script` sense extensió. Inline, els transforma vite (D3, D15, D24; sonda S3).
    server: { deps: { inline: [/@payloadcms\/(next|ui)/, /react-image-crop/, /c15t/] } },
  },
})
