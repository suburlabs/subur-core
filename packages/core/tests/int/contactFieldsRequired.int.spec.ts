import { render } from '@testing-library/react'
import { createElement } from 'react'
import type { FieldValues, UseFormRegister } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { Text } from '../../src/blocks/Contact/fields/Text.js'
import { Textarea } from '../../src/blocks/Contact/fields/Textarea.js'
import type { ContactFormLabels } from '../../src/blocks/Contact/fields/types.js'

const labels: ContactFormLabels = {
  error: 'error',
  invalidEmail: 'invalid',
  privacyHref: '/es/privacidad',
  privacyPolicy: 'Privacidad',
  required: 'Obligatorio',
  success: 'ok',
}

const register = ((name: string) => ({ name })) as unknown as UseFormRegister<FieldValues>
const shared = { errors: {}, labels, register }

/**
 * L'asterisc del rètol és `aria-hidden`: sense `aria-required`, un lector de
 * pantalla no sap que el camp és obligatori fins que l'enviament falla.
 */
describe('contact form fields announce that they are required', () => {
  it('marks a required text input', () => {
    const { container } = render(
      createElement(Text, { ...shared, blockType: 'text', label: 'Nombre', name: 'nombre', required: true }),
    )
    expect(container.querySelector('input')?.getAttribute('aria-required')).toBe('true')
  })

  it('marks a required textarea', () => {
    const { container } = render(
      createElement(Textarea, { ...shared, blockType: 'textarea', label: 'Mensaje', name: 'mensaje', required: true }),
    )
    expect(container.querySelector('textarea')?.getAttribute('aria-required')).toBe('true')
  })

  it('leaves optional fields unmarked', () => {
    const { container } = render(
      createElement(Text, { ...shared, blockType: 'text', label: 'Empresa', name: 'empresa' }),
    )
    expect(container.querySelector('input')?.hasAttribute('aria-required')).toBe(false)
  })
})
