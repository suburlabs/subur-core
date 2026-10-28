// core/packages/core/src/templates/files.ts — les llistes tancades del repositori d'un client (spec §4.2; pla E2, R2, R5)

/** Fitxers propietat del nucli que `subur sync` escriu (relatius a l'arrel del client) des de `templates/generated/`. */
export const GENERATED_FILES = [
  'src/app/(frontend)/(sitemaps)/pages-sitemap.xml/route.ts',
  'src/app/(frontend)/[locale]/[slug]/page.tsx',
  'src/app/(frontend)/[locale]/layout.tsx',
  'src/app/(frontend)/[locale]/not-found.tsx',
  'src/app/(frontend)/[locale]/page.tsx',
  'src/app/(frontend)/api/c15t/[...path]/route.ts',
  'src/app/(frontend)/api/subur-assets/[...path]/route.ts',
  'src/app/(frontend)/globals.css',
  'src/app/(frontend)/llms.txt/route.ts',
  'src/app/(frontend)/next/exit-preview/route.ts',
  'src/app/(frontend)/next/preview/route.ts',
  'src/app/(subur)/admin/[[...segments]]/not-found.tsx',
  'src/app/(subur)/admin/[[...segments]]/page.tsx',
  'src/app/(subur)/api/[...slug]/route.ts',
  'src/app/(subur)/api/graphql-playground/route.ts',
  'src/app/(subur)/api/graphql/route.ts',
  'src/app/(subur)/layout.tsx',
  'src/proxy.ts',
  'src/site/seed/run.ts',
] as const
/** El mapa d'imports del panell: el genera el motor dins de `sync`, després de les rutes. */
export const IMPORT_MAP = 'src/app/(subur)/admin/importMap.js'
/** Al `.gitignore` i al `.dockerignore`, `[` i `]` són classes de caràcters: s'escapen (ronda 1, T1/M2; sondes S2 i P6). */
export const gitignoreLine = (file: string): string => file.replace(/[[\]]/g, '\\$&')
/** Plantilles exactes de l'app (camí del client): `check` les compara byte a byte; `update` les reescriu. */
export const APP_FILES = ['.dockerignore', 'Dockerfile', 'docker-compose.dev.yml', 'eslint.config.mjs', 'next-sitemap.config.cjs', 'postcss.config.js', 'src/payload.config.ts', 'src/subur-env.d.ts', 'tsconfig.json'] as const
/** Plantilles exactes del repositori: només a l'arrel d'un repositori git (un membre d'un workspace, com la demo, no en té cap). */
export const REPO_FILES = ['.github/workflows/image.yml', '.npmrc', 'pnpm-workspace.yaml', 'renovate.json'] as const
export const EXACT_FILES = [...APP_FILES, ...REPO_FILES] as const
/** Plantilles que es copien en crear però no es comparen byte a byte (R8 diu què en reescriu `update`). */
export const COPIED_FILES = ['.env.backup.example', '.env.docker.example', '.env.example', '.gitignore', 'package.json'] as const
/** Línies que el `.gitignore` del client ha de tenir (pot tenir-ne més), escapades. */
export const REQUIRED_GITIGNORE: readonly string[] = ['node_modules/', '.next/', '.env', '.env.*', '!.env.example', '!.env.docker.example', '!.env.backup.example', 'public/media/', ...GENERATED_FILES.map(gitignoreLine), gitignoreLine(IMPORT_MAP)]
/** Scripts del `package.json` que són del contracte amb el nucli (`check` els compara amb la plantilla); `dev` i `start` són del client.
 *  `preseed` corre `subur sync`: `src/site/seed/run.ts` és generat i un clon fresc no el té fins al primer `sync`. */
export const CORE_SCRIPTS = ['predev', 'prebuild', 'build', 'postbuild', 'preseed', 'seed', 'migrate', 'check', 'gate', 'typecheck', 'lint'] as const
/** Paquets que el client no pot declarar: els porta el nucli (opció (b), R3) i el `.npmrc` de la plantilla els hissa. */
export const isEnginePackage = (name: string): boolean =>
  name === 'next' || name === 'react' || name === 'react-dom' || name === 'payload' || name === 'tailwindcss' || name === 'eslint-config-next' || name === 'graphql' || name.startsWith('@payloadcms/') || name.startsWith('@tailwindcss/')
/** Els fitxers de hooks de pnpm (`readPackage`, `afterAllResolved`): a l'arrel d'un client reescriurien les dependències del motor. */
export const PNPMFILES = ['.pnpmfile.cjs', '.pnpmfile.mjs'] as const
/** L'API del client (spec §4.2): l'únic que `src/site/**` pot importar del nucli. */
export const CLIENT_API: readonly string[] = ['@suburlabs/core/site', '@suburlabs/core/seed', '@suburlabs/core/types', '@suburlabs/core/ui']
