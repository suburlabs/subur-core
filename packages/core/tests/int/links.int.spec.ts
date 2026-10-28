import { describe, expect, it } from 'vitest'

import { resolveLinkHref } from '../../src/components/Link/resolveLinkHref.js'

describe('resolveLinkHref', () => {
  it('builds localized hrefs for page references', () => {
    const href = resolveLinkHref(
      {
        label: 'Serveis',
        reference: { relationTo: 'pages', value: { id: 1, slug: 'serveis' } as never },
        type: 'reference',
      },
      'ca',
    )
    expect(href).toBe('/ca/serveis')
  })

  it('returns custom URLs untouched', () => {
    expect(resolveLinkHref({ label: 'Llamar', type: 'custom', url: 'tel:+34600' }, 'es')).toBe(
      'tel:+34600',
    )
  })

  it('returns null for unpopulated references', () => {
    expect(
      resolveLinkHref(
        { label: 'X', reference: { relationTo: 'pages', value: 3 }, type: 'reference' },
        'es',
      ),
    ).toBeNull()
  })
})
