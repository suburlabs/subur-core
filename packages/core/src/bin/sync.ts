// core/packages/core/src/bin/sync.ts — `subur sync`: els fitxers propietat del nucli (spec §4.2; pla E2, R15)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { IMPORT_MAP } from '../templates/files.js'
import { readGenerated } from '../templates/render.js'

export type SyncResult = { written: string[]; unchanged: string[] }

const fail = (message: string) => Object.assign(new Error(`subur sync: ${message}`), { exitCode: 1 })
/** Una línia, sense traça: la «Require stack» del resolutor o la sortida del motor (aquesta ja surt per stderr) no s'hi repeteixen. */
const firstLine = (error: unknown) => (error instanceof Error ? error.message : String(error)).split('\n')[0]

/** El CLI del motor tal com el resol el client: `payload` → el seu `package.json` → `bin.payload` (sonda P5). */
export function engineBin(cwd: string): string {
  const req = createRequire(path.join(cwd, 'package.json'))
  let dir: string
  try {
    dir = path.dirname(req.resolve('payload'))
  } catch (error) {
    throw fail(`no es resol el motor des del client: ${firstLine(error)}`)
  }
  for (;;) {
    const manifest = path.join(dir, 'package.json')
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as { bin?: { payload?: string }; name?: string }
      if (pkg.name === 'payload' && pkg.bin?.payload) return path.join(dir, pkg.bin.payload)
    }
    const parent = path.dirname(dir)
    if (parent === dir) throw fail('no es troba el CLI del motor des del client')
    dir = parent
  }
}

/** Només si el contingut canvia, i atòmic (temporal + rename): `next dev` no llegeix mai un fitxer a mitges ni veu canvis espuris. */
function writeIfChanged(file: string, text: string): boolean {
  if (existsSync(file) && readFileSync(file, 'utf8') === text) return false
  mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, text)
  renameSync(tmp, file)
  return true
}

export function sync(cwd: string): SyncResult {
  for (const required of ['src/site/site.config.ts', 'src/payload.config.ts']) if (!existsSync(path.join(cwd, required))) throw fail(`falta ${required} (cal córrer des de l'arrel del client)`)
  const written: string[] = []
  const unchanged: string[] = []
  // 1. Les rutes, el proxy, globals.css i seed/run.ts, tal qual són a templates/generated/. ABANS del mapa d'imports: el motor
  //    només l'escriu si src/app/(subur)/admin/ existeix (sonda S-r9).
  for (const { clientPath, text } of readGenerated()) (writeIfChanged(path.join(cwd, clientPath), text) ? written : unchanged).push(clientPath)
  // 2. El mapa d'imports: el motor l'escriu a src/app/(subur)/admin/ (importMapFile de buildSuburConfig). Carrega la configuració
  //    del client: cal un secret i una URL de base que no s'usen (no hi connecta), com al Dockerfile.
  const importMap = path.join(cwd, IMPORT_MAP)
  const before = existsSync(importMap) ? readFileSync(importMap, 'utf8') : null
  const bin = engineBin(cwd)
  try {
    execFileSync(process.execPath, [bin, 'generate:importmap'], {
      cwd,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://sync-only:x@127.0.0.1:1/sync_only',
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --no-deprecation`.trim(),
        PAYLOAD_CONFIG_PATH: path.join(cwd, 'src/payload.config.ts'),
        SUBUR_SECRET: process.env.SUBUR_SECRET ?? 'sync-only',
      },
      stdio: ['ignore', 'ignore', 'inherit'],
    })
  } catch (error) {
    throw fail(firstLine(error))
  }
  if (!existsSync(importMap)) throw fail(`el motor no ha escrit ${IMPORT_MAP}`)
  ;(readFileSync(importMap, 'utf8') === before ? unchanged : written).push(IMPORT_MAP)
  return { written, unchanged }
}
