import { withSubur } from '@suburlabs/core/next'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
/**
 * Turbopack només llegeix dins de `root` (Task 0, variant W). Dins del workspace, @suburlabs/core és una còpia injectada
 * sota core/node_modules/.pnpm i l'arrel ha de ser la del workspace; a l'app d'acceptació (i a un client) és el directori
 * de l'app.
 * La regla és una sola: el directori més proper que té `pnpm-workspace.yaml`.
 */
function workspaceRoot(dir: string): string {
  for (let d = dir; d !== path.dirname(d); d = path.dirname(d)) if (existsSync(path.join(d, 'pnpm-workspace.yaml'))) return d
  return dir
}

export default withSubur({
  // Només en dev: perquè un mòbil a la mateixa wifi pugui carregar el JS de `pnpm dev` (Next 16 respon 403 a `/_next`
  // des de qualsevol origen no llistat aquí). No afecta producció.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '*.local'],
  turbopack: { root: workspaceRoot(dirname) },
})
