import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(CORE, 'packages/core/src/migrations')
const DIST = path.join(CORE, 'packages/core/dist/migrations')
// La demo rep el paquet injectat (una còpia a node_modules/.pnpm): si PAYLOAD_MIGRATING no arribés a la configuració,
// el motor escriuria al dist d'aquella còpia, no al del paquet. Es resol com ho fa la demo i es vigilen tots dos.
const INJECTED_DIST = path.join(path.dirname(createRequire(path.join(CORE, 'examples/demo/package.json')).resolve('@suburlabs/core/package.json')), 'dist/migrations')
const name = process.argv[2]
const skipEmpty = process.argv.includes('--skip-empty')
if (!name || !/^[a-z0-9_]+$/.test(name)) throw new Error('ús: pnpm migrate:create <nom_en_minúscules> [--skip-empty]')
const list = (dir: string) => readdirSync(dir).filter((f) => f !== 'index.ts' && f !== 'index.js').sort()
// La demo carrega buildSuburConfig de dist: sense build, el motor compararia amb l'esquema vell.
execFileSync('pnpm', ['-C', CORE, 'build'], { stdio: 'inherit' })
const srcBefore = new Set(list(SRC))
const distBefore = [DIST, INJECTED_DIST].map((dir) => list(dir).join(','))
// El CLI del motor importa la configuració abans de posar PAYLOAD_MIGRATING: el posem nosaltres, perquè migrationDirOf
// triï src/ en carregar-la (sonda S1: només amb SUBUR_MIGRATIONS_SRC, la migració va a dist/).
execFileSync('pnpm', ['-C', path.join(CORE, 'examples/demo'), 'exec', 'payload', 'migrate:create', name, ...process.argv.slice(3)], {
  env: { ...process.env, PAYLOAD_MIGRATING: 'true', SUBUR_MIGRATIONS_SRC: SRC },
  stdio: 'inherit',
})
const created = list(SRC).filter((f) => !srcBefore.has(f))
if ([DIST, INJECTED_DIST].some((dir, i) => list(dir).join(',') !== distBefore[i])) throw new Error('migrate:create: el motor ha escrit a dist/migrations, no a src (PAYLOAD_MIGRATING no ha arribat a la configuració)')
if (created.length === 0) {
  if (!skipEmpty) throw new Error('migrate:create: cap fitxer nou a src/migrations')
  console.log('migrate:create: cap canvi d\'esquema (cap fitxer nou)')
  process.exit(0)
}
if (created.length !== 2 || !created.every((f) => f.endsWith(`_${name}.ts`) || f.endsWith(`_${name}.json`))) throw new Error(`migrate:create: s'esperava una parella _${name}.{ts,json}, hi ha ${created.join(', ')}`)
// El motor escriu l'index sense .js si el tsconfig del cwd no és NodeNext (writeMigrationIndex): el paquet els vol amb .js.
const index = path.join(SRC, 'index.ts')
const text = readFileSync(index, 'utf8').replace(/from '(\.\/[^']+?)(?<!\.js)'/g, "from '$1.js'")
writeFileSync(index, text)
if (/from '\.\/[^']+(?<!\.js)'/.test(text)) throw new Error('migrate:create: index.ts amb imports sense .js')
console.log(`migrate:create: ${created.join(', ')}`)
