import type { VariantProps } from 'class-variance-authority'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Button, type buttonVariants } from '../ui/button.js'
import type { Locale } from '../../i18n/config.js'
import { cn } from '../../utilities/ui.js'

import { type LinkData, resolveLinkHref } from './resolveLinkHref.js'

type ButtonVariants = VariantProps<typeof buttonVariants>

type CMSLinkProps = LinkData & {
  appearance?: 'inline' | NonNullable<ButtonVariants['variant']>
  children?: ReactNode
  className?: string
  locale: Locale
  size?: ButtonVariants['size']
}

export function CMSLink({
  appearance = 'inline',
  children,
  className,
  locale,
  size,
  ...link
}: CMSLinkProps) {
  const href = resolveLinkHref(link, locale)
  if (!href) return null

  const newTabProps = link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {}
  const content = (
    <>
      {link.label}
      {children}
    </>
  )

  if (appearance === 'inline') {
    return (
      <Link className={cn(className)} href={href} {...newTabProps}>
        {content}
      </Link>
    )
  }

  return (
    <Button asChild className={className} size={size} variant={appearance}>
      <Link href={href} {...newTabProps}>
        {content}
      </Link>
    </Button>
  )
}
