// core/scripts/guards/clientData.test.ts — cap literal de client: tot es construeix en temps d'execució
import { describe, expect, it } from 'vitest'

import { applyAllowlist, missingPackTargets, scanForClientData } from './clientData'

const j = (...parts: string[]) => parts.join('')
const rules = (text: string, file = 'x.ts') => scanForClientData([{ path: file, text }]).map((f) => f.rule)

describe('guarda «cap dada de client» (spec §11)', () => {
  it('detecta el nom del client, la xarxa del servidor, el servidor i els tokens pel context', () => {
    expect(rules(`const s = "${j('s', 'itges')}"`)).toEqual(['client'])
    expect(rules(j('House', 'keeping'))).toEqual(['client'])
    // Una IP construïda en temps d'execució dins del rang que la regla busca (cap IP real escrita)
    expect(rules(`ssh root@${['9' + '1', '98', '0', '1'].join('.')}`)).toEqual(['ip'])
    expect(rules(j('/srv/', 'subur/clients'))).toEqual(['servidor'])
    expect(rules(`"${j('hb', 'Token')}": "x"`)).toEqual(['token'])
    expect(rules(`https://m.example/hb/${'0123456789abcdef'.repeat(2)}`)).toEqual(['token'])
    expect(rules(`${j('BACKUP_HEARTBEAT', '_URL')}=https://x`)).toEqual(['token'])
  })
  it('correus: els de Subur i els dominis reservats passen; un de personal, no', () => {
    expect(rules('hola@subur.dev ci@subur.dev admin@subur.dev hola@demo.example client@example.com e2e@example.com ops@subur.example x@y.test hola@ejemplo.com info@payloadcms.com')).toEqual([])
    // Les exempcions són adreces exactes, no prefixos de domini: tot el que s'hi assembla salta
    for (const near of [j('x', '@payloadcms-client.es'), j('x', '@suburlabs.com'), j('x', '@subur.com'), j('x', '@example.com.es'), j('x', '@mail.subur.dev'), j('xhola', '@ejemplo.com')]) {
      expect(rules(near), near).toEqual(['correu'])
    }
    // L'exempció del marcador del text d'ajuda és exacta: una altra adreça del mateix domini salta
    expect(rules(j('adeu', '@ejemplo.com'))).toEqual(['correu'])
    expect(rules(j('mario', '@vil', 'ar.dev'))).toEqual(['correu'])
  })
  it('marca: el catàleg, el logo de Subur, el seu dibuix ASCII i les tipografies', () => {
    expect(rules(`import x from '${j('@suburlabs/', 'catalog')}/brand'`)).toEqual(['marca'])
    expect(rules(`export function ${j('Subur', 'Logo')}() {}`)).toEqual(['marca'])
    expect(rules(j('{<', '---', '>}'))).toEqual(['marca'])
    expect(rules(`font-family: '${j('Plus Jak', 'arta Sans')}'`)).toEqual(['marca'])
    expect(rules(`import { ${j('Instrument_', 'Serif')} } from 'next/font/google'`)).toEqual(['marca'])
    expect(rules(j('JetBr', 'ains Mono'))).toEqual(['marca'])
    expect(rules(j('<', '===', '>'))).toEqual(['marca'])
  })
  it('un idioma per defecte literal al codi del paquet', () => {
    expect(rules(`  ${j('default', 'Locale')}: 'es',`, 'packages/core/src/x.ts')).toEqual(['locale'])
    // Qualsevol cometa, la clau entre cometes i les tres claus
    expect(rules(`  ${j('default', 'Locale')}: "es",`, 'packages/core/src/x.ts')).toEqual(['locale'])
    expect(rules(`  "${j('default', 'Locale')}": "es",`, 'packages/core/src/x.json')).toEqual(['locale'])
    expect(rules(`  ${j('fallback', 'Locale')} = \`ca\``, 'packages/core/src/x.ts')).toEqual(['locale'])
    expect(rules(`  ${j('fallback', 'Language')}: 'en',`, 'packages/core/src/x.ts')).toEqual(['locale'])
    expect(rules(`  ${j('default', 'Locale')}: 'es',`, 'examples/demo/src/site/site.config.ts')).toEqual([])
    expect(rules(`  ${j('default', 'Locale')}: 'es',`, 'packages/core/src/i18n/catalog.ts')).toEqual([])
  })
  it('els hash de l\'importMap i dels tests no salten (no es busca [0-9a-f]{32} sol)', () => {
    expect(rules(`RowLabel_${'ec255a65fa6fa8d1'.repeat(2)}`)).toEqual([])
  })
  it('la llista permesa filtra per (fitxer, regla) i falla si queda òrfena', () => {
    const findings = [{ line: 1, path: 'a.ts', rule: 'client' }]
    expect(applyAllowlist(findings, { 'a.ts': ['client'] })).toEqual({ kept: [], stale: [] })
    expect(applyAllowlist([], { 'a.ts': ['client'] }).stale).toEqual(['a.ts: client'])
    // Una entrada d'una altra regla al mateix fitxer no s'empassa la troballa, i queda òrfena
    const other = applyAllowlist([{ line: 1, path: 'a.ts', rule: 'ip' }], { 'a.ts': ['client'] })
    expect(other.kept).toHaveLength(1)
    expect(other.stale).toEqual(['a.ts: client'])
  })
  it('el tarball ha de ser el construït: cada destí default/import d\'exports hi és', () => {
    const exportsMap = { './css': './dist/css/core.css', './package.json': './package.json', './site': { default: './dist/site/index.js', types: './dist/site/index.d.ts' }, './types': { types: './dist/types/index.d.ts' } }
    expect(missingPackTargets(exportsMap, ['package.json', 'dist/css/core.css', 'dist/site/index.js'])).toEqual([])
    expect(missingPackTargets(exportsMap, ['package.json', 'bin/subur.js', 'LICENSE'])).toEqual(['dist/css/core.css', 'dist/site/index.js'])
    expect(missingPackTargets({ './x': { import: './dist/x.mjs' } }, [])).toEqual(['dist/x.mjs'])
  })
})
