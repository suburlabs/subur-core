import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

// La clau sempre existeix: `SAFE` fixa l'extensió a png, svg o webp.
const TYPES: Record<string, string> = { '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' }
// Només blocks/ i icons/, un sol nivell i noms segurs: cap `..`, cap ruta absoluta, cap separador codificat.
const SAFE = /^(blocks|icons)\/[A-Za-z0-9_-]+\.(png|svg|webp)$/

/** Resolució des de l'arrel de l'app (Task 0, regla 3): funciona en dev, next start i a l'standalone. */
export const suburAssetsDir = (cwd = process.cwd()): string =>
  path.join(path.dirname(createRequire(path.join(cwd, 'package.json')).resolve('@suburlabs/core/package.json')), 'dist/assets')

export function createSuburAssetsRoute({ root }: { root?: string } = {}) {
  return {
    async GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }): Promise<Response> {
      const rel = (await params).path.join('/')
      if (!SAFE.test(rel)) return new Response('Not found', { status: 404 })
      try {
        const body = await readFile(path.join(root ?? suburAssetsDir(), rel))
        return new Response(body, {
          // immutable: els noms de `dist/assets` no porten hash; si una imatge canvia de contingut, canvia-li el nom (mateixa regla que els pòsters del hero a `withSubur`).
          headers: { 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Type': TYPES[path.extname(rel)] },
        })
      } catch {
        return new Response('Not found', { status: 404 })
      }
    },
  }
}
