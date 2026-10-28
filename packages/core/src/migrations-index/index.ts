import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

import { migrations as all } from '../migrations/index.js'

/**
 * Fora de migrations/: el motor llegeix com a migració tot .js d'aquell directori llevat d'index.js. El tipus és
 * explícit perquè la declaració sigui autònoma: build.ts esborra els .d.ts de dist/migrations (spec §3.3).
 */
export const migrations: Array<{ name: string; up: (args: MigrateUpArgs) => Promise<void>; down: (args: MigrateDownArgs) => Promise<void> }> = all
