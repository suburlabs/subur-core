import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

/**
 * La política de `robots.txt` (spec §20.5) es comprova a la configuració, no al
 * fitxer servit: `public/robots.txt` el genera `postbuild` i no és al
 * repositori, de manera que canviar la política sense tornar a construir
 * deixaria l'e2e comprovant un fitxer vell. Aquí no hi cal ni build ni servidor.
 */
type RobotsConfig = {
  generateRobotsTxt: boolean
  robotsTxtOptions: {
    policies: Array<{ allow?: string[]; disallow?: string[]; userAgent: string }>
  }
}

const requireCjs = createRequire(import.meta.url)
const config = requireCjs('../../next-sitemap.config.cjs') as RobotsConfig

describe('next-sitemap: política de robots.txt', () => {
  it('genera el fitxer amb les tres regles i deixa passar les imatges', () => {
    expect(config.generateRobotsTxt).toBe(true)
    expect(config.robotsTxtOptions.policies).toEqual([
      { allow: ['/api/media/file/'], disallow: ['/admin', '/api/', '/next'], userAgent: '*' },
    ])
  })
})
