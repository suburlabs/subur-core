import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

import RichText from '../../../components/RichText/index.js'
import type { Locale } from '../../../i18n/config.js'

export function Message({ locale, message }: { locale: Locale; message?: DefaultTypedEditorState }) {
  if (!message) return null
  return (
    <div className="sm:col-span-2">
      <RichText data={message} enableGutter={false} locale={locale} />
    </div>
  )
}
