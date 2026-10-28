import type { Locale } from '../../i18n/config.js'

import { suburCredit } from './credit.js'

export function SuburCredit({ className, locale }: { className?: string; locale: Locale }) {
  const { href, text } = suburCredit[locale]
  const [prefix, brand] = text.split(/(Subur)$/)

  return (
    <p className={className} data-subur-credit>
      {prefix}
      <a
        className="font-semibold text-shutter-foreground underline decoration-1 underline-offset-4 hover:decoration-2"
        href={href}
        rel="noopener"
        target="_blank"
      >
        {brand}
      </a>
    </p>
  )
}
