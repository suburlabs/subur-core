import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('subur check a la demo (R4)', () => {
  it('surt 0: la demo té la forma d\'un client; els 4 fitxers de repositori no li toquen (membre del workspace)', () => {
    const r = spawnSync('pnpm', ['-s', 'exec', 'subur', 'check'], { encoding: 'utf8' })
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/^check: membre d'un workspace: 4 fitxers de repositori no comprovats/m)
    expect(r.stdout).toMatch(/^check: ok \(10 comprovacions\)$/m)
  })
})
