import { describe, expect, it } from 'vitest'

import { buildLlmsTxt, type LlmsTxtInput } from '../../src/utilities/llmsTxt.js'

const input: LlmsTxtInput = {
  activeLocales: ['es', 'ca'],
  defaultLocale: 'es',
  facts: { areaServed: ['Vila Exemple', 'Poble Exemple'], email: 'hola@x.example', locality: 'Vila Exemple', phone: '+34 600 000 000' },
  legalSlugs: ['aviso-legal', 'privacidad'],
  pages: [
    { slug: 'serveis', byLocale: { ca: { title: 'Serveis' }, es: { description: 'Arreglos', title: 'Servicios' } } },
    { slug: 'home', byLocale: { ca: { title: 'Inici' }, es: { description: 'Servicios en Vila Exemple', title: 'Inicio' } } },
    { slug: 'aviso-legal', byLocale: { es: { title: 'Aviso legal' } } },
    { slug: 'privacidad', byLocale: { es: { title: 'Privacidad' } } },
  ],
  siteName: 'Web de Prova',
  siteUrl: 'https://x.example',
}

/** Gramàtica mínima de llmstxt.org que el fitxer ha de complir sempre. */
const assertGrammar = (text: string) => {
  const lines = text.split('\n')
  expect(lines[0]).toMatch(/^# \S/)
  expect(lines.filter((l) => l.startsWith('# '))).toHaveLength(1)
  for (const line of lines.filter((l) => l.startsWith('- '))) {
    expect(line).toMatch(/^- \[[^\]]+\]\(https?:\/\/[^)\s]+\)(: .+)?$/)
  }
  expect(text.endsWith('\n')).toBe(true)
}

describe('buildLlmsTxt', () => {
  it('capçalera, cita, fets, una secció per idioma actiu i les legals a Optional', () => {
    const text = buildLlmsTxt(input)
    assertGrammar(text)
    expect(text).toBe(
      [
        '# Web de Prova',
        '',
        '> Servicios en Vila Exemple',
        '',
        'Vila Exemple · Vila Exemple, Poble Exemple · +34 600 000 000 · hola@x.example',
        '',
        '## Español',
        '- [Inicio](https://x.example/es): Servicios en Vila Exemple',
        '- [Servicios](https://x.example/es/serveis): Arreglos',
        '',
        '## Català',
        '- [Inici](https://x.example/ca)',
        '- [Serveis](https://x.example/ca/serveis)',
        '',
        '## Optional',
        '- [Aviso legal](https://x.example/es/aviso-legal)',
        '- [Privacidad](https://x.example/es/privacidad)',
        '',
      ].join('\n'),
    )
  })

  it('sense descripció a l’inici, sense cita; sense fets, sense línia de fets', () => {
    const text = buildLlmsTxt({
      ...input,
      facts: { areaServed: [] },
      pages: [{ slug: 'home', byLocale: { es: { title: 'Inicio' } } }],
    })
    assertGrammar(text)
    expect(text).not.toContain('>')
    expect(text).toBe('# Web de Prova\n\n## Español\n- [Inicio](https://x.example/es)\n')
  })

  it('cap idioma inactiu, encara que la pàgina hi tingui traducció', () => {
    const text = buildLlmsTxt({ ...input, activeLocales: ['es'] })
    expect(text).not.toContain('## Català')
    expect(text).not.toContain('/ca')
  })
})
