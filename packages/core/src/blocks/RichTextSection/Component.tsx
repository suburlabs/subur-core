import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

import RichText from '../../components/RichText/index.js'
import type { RichTextSectionBlock } from '../../types/subur-types.js'

import type { BlockContext } from '../types.js'

export function RichTextSection({ content, locale }: RichTextSectionBlock & BlockContext) {
  return (
    <section className="wrap py-section" data-block="richTextSection">
      <RichText
        className="mx-auto"
        data={content as DefaultTypedEditorState}
        enableGutter={false}
        locale={locale}
      />
    </section>
  )
}
