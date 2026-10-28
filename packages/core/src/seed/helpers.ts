import type { Form } from '../types/subur-types.js'

type LexicalState = NonNullable<Form['confirmationMessage']>

const textNode = (text: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  type: 'text',
  version: 1,
})

export const paragraph = (text: string) => ({
  children: [textNode(text)],
  direction: 'ltr' as const,
  format: '' as const,
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
})

export const heading = (tag: 'h2' | 'h3', text: string) => ({
  children: [textNode(text)],
  direction: 'ltr' as const,
  format: '' as const,
  indent: 0,
  tag,
  type: 'heading',
  version: 1,
})

export const richText = (
  ...children: Array<ReturnType<typeof heading> | ReturnType<typeof paragraph>>
): LexicalState => ({
  root: {
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

export const pageLink = (id: number, label: string) => ({
  label,
  newTab: false,
  reference: { relationTo: 'pages' as const, value: id },
  type: 'reference' as const,
})

export const urlLink = (url: string, label: string) => ({
  label,
  newTab: false,
  type: 'custom' as const,
  url,
})
