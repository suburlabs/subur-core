import type {
  DefaultNodeTypes,
  DefaultTypedEditorState,
  SerializedLinkNode,
} from '@payloadcms/richtext-lexical'
import {
  type JSXConvertersFunction,
  LinkJSXConverter,
  RichText as ConvertRichText,
} from '@payloadcms/richtext-lexical/react'

import { type Locale } from '../../i18n/config.js'
import { pageHref } from '../../i18n/paths.js'
import { cn } from '../../utilities/ui.js'

const converters =
  (locale: Locale): JSXConvertersFunction<DefaultNodeTypes> =>
  ({ defaultConverters }) => ({
    ...defaultConverters,
    ...LinkJSXConverter({
      internalDocToHref: ({ linkNode }: { linkNode: SerializedLinkNode }) => {
        const { value } = linkNode.fields.doc!
        if (typeof value !== 'object' || !value.slug) return pageHref(locale, 'home')
        return pageHref(locale, value.slug as string)
      },
    }),
  })

type Props = {
  data: DefaultTypedEditorState
  enableGutter?: boolean
  enableProse?: boolean
  locale: Locale
} & React.HTMLAttributes<HTMLDivElement>

export default function RichText({
  className,
  enableGutter = true,
  enableProse = true,
  locale,
  ...rest
}: Props) {
  return (
    <ConvertRichText
      className={cn(
        { wrap: enableGutter, 'max-w-none': !enableGutter, 'mx-auto prose': enableProse },
        className,
      )}
      converters={converters(locale)}
      {...rest}
    />
  )
}
