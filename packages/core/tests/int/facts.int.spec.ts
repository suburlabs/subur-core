import { describe, expect, it } from 'vitest'
import { collectFacts, parseFacts } from '../../src/subur/facts.js'

const siteConfig = {
  assets: { heroFilm: { posters: [{ height: 1, src: '/site/hero/poster-1.webp', width: 1 }] } },
  clientLocale: 'ca', defaultLocale: 'en', domain: 'fixture.example', id: 'fixture', name: 'Web de Prova',
  themeColor: { dark: '#101418', light: '#f6f6f4' },
} as unknown as Parameters<typeof collectFacts>[0]['siteConfig']   // un siteConfig parcial: només els camps que els fets llegeixen
const input = (maxLanguages: number | null) => ({ backupVersion: null, contract: maxLanguages === null ? null : { maxLanguages }, packageVersion: '0.0.0', siteConfig })

describe('fets del paquet (spec §5.2; ruling P19)', () => {
  it('activeLocales = seedOrderOf retallat a maxLanguages; sense contracte, només el per defecte', () => {
    expect(collectFacts(input(2)).activeLocales).toEqual(['en', 'es'])
    expect(collectFacts(input(null)).activeLocales).toEqual(['en'])
  })
  it('themeColor del client, i anada i tornada per parseFacts', () => {
    const facts = collectFacts(input(3))
    expect(facts.themeColor).toEqual({ dark: '#101418', light: '#f6f6f4' })
    expect(parseFacts(JSON.stringify(facts))).toEqual(facts)
  })
  it('parseFacts accepta null (l\'script d\'E3a) i rebutja formes invàlides', () => {
    const facts = collectFacts(input(1))
    expect(parseFacts(JSON.stringify({ ...facts, themeColor: null })).themeColor).toBeNull()
    expect(() => parseFacts(JSON.stringify({ ...facts, themeColor: { light: 'red' } }))).toThrow(/themeColor/)
  })
  // Nota del controlador: el themeColor del client passa la mateixa validació que parseFacts (#rrggbb), perquè
  // `subur facts` mai emeti uns fets que el protocol rebutjaria.
  it('collectFacts rebutja un themeColor que no sigui #rrggbb', () => {
    const bad = (themeColor: { dark: string; light: string }) => () => collectFacts({ ...input(1), siteConfig: { ...siteConfig, themeColor } })
    expect(bad({ dark: '#101418', light: 'red' })).toThrow(/themeColor/)
    expect(bad({ dark: '#fff', light: '#f6f6f4' })).toThrow(/themeColor/)
  })
})
